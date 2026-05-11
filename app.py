import os
import re
import json
import sqlite3

from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash

import mysql.connector

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret_key_change_in_prod")


# ---------------------------------------------------------------------------
# Base de datos
# ---------------------------------------------------------------------------

def get_db_connection():
    """Retorna una conexión activa a la base de datos (MySQL o SQLite)."""
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "partenvet_db"),
            connect_timeout=2
        )
        if conn.is_connected():
            return conn
    except Exception:
        pass  # MySQL no disponible, se usa SQLite

    db_path = os.path.join("database", "partenvet.db")
    is_new = not os.path.exists(db_path)
    os.makedirs("database", exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    if is_new:
        _init_sqlite(conn)

    return conn


def _init_sqlite(conn):
    """Crea las tablas en SQLite a partir de schema.sql."""
    schema_path = os.path.join("database", "schema.sql")
    if not os.path.exists(schema_path):
        return

    with open(schema_path, "r", encoding="utf-8") as f:
        schema = f.read()

    # Adaptaciones de sintaxis MySQL -> SQLite
    schema = schema.replace("AUTO_INCREMENT", "AUTOINCREMENT")
    schema = schema.replace("INT AUTOINCREMENT PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
    schema = schema.replace("INT PRIMARY KEY AUTOINCREMENT",  "INTEGER PRIMARY KEY AUTOINCREMENT")
    schema = re.sub(r"ENUM\(.*?\)", "VARCHAR(50)", schema)
    schema = schema.replace("JSON", "TEXT")
    schema = schema.replace("TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
                            "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    schema = schema.replace("ON DELETE RESTRICT", "")
    schema = schema.replace("INSERT IGNORE", "INSERT OR IGNORE")

    try:
        conn.executescript(schema)
        conn.commit()
    except Exception as e:
        print(f"Error al inicializar SQLite: {e}")


def execute_query(query, params=None, fetch=False, commit=False):
    """Ejecuta una consulta SQL y retorna los resultados si se requieren."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        is_sqlite = isinstance(conn, sqlite3.Connection)
        if is_sqlite:
            query = query.replace("%s", "?")
            cursor = conn.cursor()
        else:
            cursor = conn.cursor(dictionary=True)

        cursor.execute(query, params or ())

        if commit:
            conn.commit()

        if fetch:
            rows = cursor.fetchall()
            return [dict(r) for r in rows] if is_sqlite else rows

        return True
    except Exception as e:
        print(f"Error en execute_query: {e}")
        return None
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Autenticación
# ---------------------------------------------------------------------------

def login_required(f):
    """Requiere sesión activa para acceder a la ruta."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "usuario" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    """Requiere rol de Administrador Veterinario."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "usuario" not in session or session.get("rol") != "Administrador Veterinario":
            return jsonify({"success": False, "message": "Acceso restringido"}), 403
        return f(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Rutas HTML
# ---------------------------------------------------------------------------

@app.route("/")
@app.route("/login")
def login():
    if "usuario" in session:
        return redirect(url_for("dashboard"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")


@app.route("/pacientes")
@login_required
def pacientes_list():
    return render_template("patients/list.html")


@app.route("/pacientes/nuevo")
@login_required
def pacientes_register():
    return render_template("patients/register.html")


@app.route("/historial")
@login_required
def historial():
    return render_template("patients/list.html")


@app.route("/vetscribe")
@login_required
def vetscribe_module():
    return render_template("modules/vetscribe.html")


@app.route("/safe-anesthesia")
@login_required
def safeanesth_module():
    return render_template("modules/safeanesth.html")


@app.route("/usuarios")
@login_required
@admin_required
def users_management():
    return render_template("users/management.html")





# ---------------------------------------------------------------------------
# API — Autenticación
# ---------------------------------------------------------------------------

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json()
    if not data or not data.get("correo") or not data.get("password"):
        return jsonify({"success": False, "message": "Faltan credenciales"}), 400

    query = """
        SELECT u.id_usuario, u.nombre, u.password_hash, r.nombre as rol
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.correo = %s AND u.estado = 'activo'
    """
    users = execute_query(query, (data["correo"],), fetch=True)

    if not users or not check_password_hash(users[0]["password_hash"], data["password"]):
        execute_query(
            "INSERT INTO logs_sistema (accion, descripcion, ip_origen) VALUES (%s, %s, %s)",
            ("LOGIN_FALLIDO", f"Intento fallido: {data['correo']}", request.remote_addr),
            commit=True
        )
        return jsonify({"success": False, "message": "Credenciales incorrectas"}), 401

    usuario = users[0]
    session["usuario"]    = data["correo"]
    session["usuario_id"] = usuario["id_usuario"]
    session["nombre"]     = usuario["nombre"]
    session["rol"]        = usuario["rol"]

    execute_query(
        "INSERT INTO logs_sistema (usuario_id, accion, descripcion, ip_origen) VALUES (%s, %s, %s, %s)",
        (usuario["id_usuario"], "INICIO_SESION", f"Login: {data['correo']}", request.remote_addr),
        commit=True
    )

    return jsonify({
        "success": True,
        "message": "Login exitoso",
        "usuario": {"nombre": session["nombre"], "rol": session["rol"]}
    })


# ---------------------------------------------------------------------------
# API — Usuarios y Roles
# ---------------------------------------------------------------------------

@app.route("/api/roles", methods=["GET"])
@login_required
@admin_required
def get_roles():
    query = "SELECT id, nombre, descripcion FROM roles"
    roles = execute_query(query, fetch=True)
    return jsonify({"success": True, "data": roles})


@app.route("/api/usuarios", methods=["GET"])
@login_required
@admin_required
def get_usuarios():
    query = """
        SELECT u.id_usuario as id, u.nombre, u.correo, u.estado, r.nombre as rol, u.rol_id
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        ORDER BY u.id_usuario DESC
    """
    usuarios = execute_query(query, fetch=True)
    return jsonify({"success": True, "data": usuarios})


@app.route("/api/usuarios", methods=["POST"])
@login_required
@admin_required
def create_usuario():
    data = request.get_json()
    nombre = data.get("nombre")
    correo = data.get("correo")
    password = data.get("password")
    rol_id = data.get("rol_id")
    
    if not all([nombre, correo, password, rol_id]):
        return jsonify({"success": False, "message": "Todos los campos son obligatorios"}), 400
        
    pwd_hash = generate_password_hash(password)
    query = "INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES (%s, %s, %s, %s)"
    res = execute_query(query, (nombre, correo, pwd_hash, rol_id), commit=True)
    
    if res:
        return jsonify({"success": True, "message": "Usuario creado exitosamente"})
    else:
        return jsonify({"success": False, "message": "Error al crear usuario (¿correo duplicado?)"}), 400


@app.route("/api/usuarios/<int:id>", methods=["DELETE"])
@login_required
@admin_required
def delete_usuario(id):
    if id == session.get("usuario_id"):
        return jsonify({"success": False, "message": "No puedes eliminar tu propio usuario"}), 400
        
    query = "DELETE FROM usuarios WHERE id_usuario = %s"
    res = execute_query(query, (id,), commit=True)
    if res:
        return jsonify({"success": True, "message": "Usuario eliminado"})
    return jsonify({"success": False, "message": "Error al eliminar usuario"}), 400


# ---------------------------------------------------------------------------
# API — Pacientes
# ---------------------------------------------------------------------------

@app.route("/api/pacientes", methods=["GET"])
@login_required
def api_get_pacientes():
    query = """
        SELECT p.*, t.nombres as tutor_nombre, t.apellidos as tutor_apellidos, t.telefono as tutor_telefono
        FROM pacientes p
        JOIN tutores t ON p.tutor_id = t.id
    """
    search = request.args.get("q")
    params = None
    if search:
        query += " WHERE p.nombre LIKE %s OR t.nombres LIKE %s OR t.rut_dni LIKE %s"
        params = (f"%{search}%", f"%{search}%", f"%{search}%")

    pacientes = execute_query(query, params, fetch=True)
    return jsonify({"success": True, "data": pacientes or []})


@app.route("/api/pacientes/<int:id>", methods=["GET"])
@login_required
def api_get_paciente(id):
    query = """
        SELECT p.*, t.rut_dni, t.nombres as tutor_nombres, t.apellidos as tutor_apellidos,
               t.telefono as tutor_telefono, t.correo as tutor_correo, t.direccion as tutor_direccion
        FROM pacientes p
        JOIN tutores t ON p.tutor_id = t.id
        WHERE p.id = %s
    """
    rows = execute_query(query, (id,), fetch=True)
    if not rows:
        return jsonify({"success": False, "message": "Paciente no encontrado"}), 404

    paciente = rows[0]
    if paciente.get("fecha_nacimiento") and hasattr(paciente["fecha_nacimiento"], "strftime"):
        paciente["fecha_nacimiento"] = paciente["fecha_nacimiento"].strftime("%Y-%m-%d")

    return jsonify({"success": True, "data": paciente})


@app.route("/api/pacientes", methods=["POST"])
@login_required
def api_create_paciente():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Datos vacíos"}), 400

    try:
        execute_query(
            "INSERT INTO tutores (rut_dni, nombres, apellidos, telefono, correo, direccion) VALUES (%s,%s,%s,%s,%s,%s)",
            (data.get("rut_tutor"), data.get("nombres_tutor"), data.get("apellidos_tutor"),
             data.get("telefono_tutor"), data.get("correo_tutor"), data.get("direccion_tutor")),
            commit=True
        )
        last = execute_query("SELECT id FROM tutores ORDER BY id DESC LIMIT 1", fetch=True)
        tutor_id = last[0]["id"]

        execute_query(
            "INSERT INTO pacientes (tutor_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_actual) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (tutor_id, data.get("nombre_paciente"), data.get("especie"), data.get("raza"),
             data.get("sexo"), data.get("fecha_nacimiento"), data.get("peso")),
            commit=True
        )
        return jsonify({"success": True, "message": "Paciente registrado"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/pacientes/<int:id>", methods=["PUT"])
@login_required
def api_update_paciente(id):
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Datos vacíos"}), 400

    try:
        execute_query(
            "UPDATE pacientes SET nombre=%s, especie=%s, raza=%s, sexo=%s, fecha_nacimiento=%s, peso_actual=%s WHERE id=%s",
            (data.get("nombre_paciente"), data.get("especie"), data.get("raza"),
             data.get("sexo"), data.get("fecha_nacimiento"), data.get("peso"), id),
            commit=True
        )
        tutor_res = execute_query("SELECT tutor_id FROM pacientes WHERE id=%s", (id,), fetch=True)
        if tutor_res:
            tutor_id = tutor_res[0]["tutor_id"]
            execute_query(
                "UPDATE tutores SET rut_dni=%s, nombres=%s, apellidos=%s, telefono=%s, correo=%s, direccion=%s WHERE id=%s",
                (data.get("rut_tutor"), data.get("nombres_tutor"), data.get("apellidos_tutor"),
                 data.get("telefono_tutor"), data.get("correo_tutor"), data.get("direccion_tutor"), tutor_id),
                commit=True
            )
        return jsonify({"success": True, "message": "Paciente actualizado"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/pacientes/<int:id>", methods=["DELETE"])
@login_required
def api_delete_paciente(id):
    try:
        execute_query("DELETE FROM pacientes WHERE id = %s", (id,), commit=True)
        return jsonify({"success": True, "message": "Paciente eliminado"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ---------------------------------------------------------------------------
# API — Paciente activo en sesión
# ---------------------------------------------------------------------------

@app.route("/api/paciente-activo", methods=["GET"])
@login_required
def api_get_paciente_activo():
    id_activo = session.get("paciente_id_activo")
    if not id_activo:
        return jsonify({"success": False, "message": "No hay paciente activo"}), 404

    rows = execute_query(
        """SELECT p.*, t.nombres as tutor_nombre, t.apellidos as tutor_apellidos
           FROM pacientes p JOIN tutores t ON p.tutor_id = t.id WHERE p.id = %s""",
        (id_activo,), fetch=True
    )
    if not rows:
        return jsonify({"success": False, "message": "Paciente no encontrado"}), 404

    return jsonify({"success": True, "data": rows[0]})


@app.route("/api/paciente-activo/<int:id>", methods=["POST"])
@login_required
def api_set_paciente_activo(id):
    session["paciente_id_activo"] = id
    return jsonify({"success": True, "message": "Paciente activo actualizado"})


# ---------------------------------------------------------------------------
# API — Documentos y cálculos anestésicos
# ---------------------------------------------------------------------------

@app.route("/api/documentos", methods=["POST"])
@login_required
def api_save_documento():
    data = request.get_json()
    try:
        execute_query(
            "INSERT INTO documentos (paciente_id, usuario_id, tipo_documento, contenido_json) VALUES (%s,%s,%s,%s)",
            (data.get("paciente_id"), session["usuario_id"],
             data.get("tipo_documento"), json.dumps(data.get("contenido_json"))),
            commit=True
        )
        return jsonify({"success": True, "message": "Documento guardado"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/calculos_anestesia", methods=["POST"])
@login_required
def api_save_calculo_anestesia():
    data = request.get_json()
    try:
        execute_query(
            "INSERT INTO calculos_anestesia (paciente_id, usuario_id, peso_utilizado, riesgo_asa, protocolo_json) VALUES (%s,%s,%s,%s,%s)",
            (data.get("paciente_id"), session["usuario_id"],
             data.get("peso_utilizado"), data.get("riesgo_asa"),
             json.dumps(data.get("protocolo_json"))),
            commit=True
        )
        return jsonify({"success": True, "message": "Protocolo guardado"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ---------------------------------------------------------------------------
# API — Logs (solo administrador)
# ---------------------------------------------------------------------------

@app.route("/api/logs", methods=["GET"])
@admin_required
def api_get_logs():
    logs = execute_query(
        """SELECT l.*, u.nombre as usuario_nombre
           FROM logs_sistema l
           LEFT JOIN usuarios u ON l.usuario_id = u.id_usuario
           ORDER BY l.created_at DESC LIMIT 50""",
        fetch=True
    )
    return jsonify({"success": True, "logs": logs or []})


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
