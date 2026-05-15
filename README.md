# PartenVet – Plataforma Clínica Veterinaria Modular

> **Proyecto de Titulación** · Instituto IPLACEX  
> Desarrollado con **Flask**, **MySQL**, **HTML5/CSS3** y **JavaScript** puro.

---

## Acceso a la aplicación alojada

URL Hosting:
[PEGAR AQUÍ LINK DEL HOSTING]

## Credenciales de demostración

**Administrador Veterinario:**
- **Email:** admin@partenvet.cl
- **Contraseña:** admin123
- **Permisos:** acceso completo, VetScribe, SafeAnesthesia, usuarios y auditoría.

**Asistente Clínico:**
- **Email:** asistente@partenvet.cl
- **Contraseña:** asistente123
- **Permisos:** base clínica, registro/búsqueda de pacientes e historial básico.

---

## Descripción

**PartenVet** es una plataforma web modular para apoyo clínico veterinario. Funciona como un panel centralizado de acceso (*Launcher Clínico*) que integra dos módulos especializados bajo una arquitectura común:

- **VetScribe** – Generación de recetas médicas, certificados clínicos y órdenes de examen.  
- **SafeAnesthesia** – Cálculo de dosis anestésicas, protocolos TIVA y órdenes técnicas para cirugía.

Ambos módulos comparten una **base de datos clínica única**, un **sistema de autenticación centralizado** y un **diseño visual unificado**, eliminando la necesidad de múltiples logins o sistemas paralelos.

---

## Arquitectura del Sistema (3 Capas)

```text
┌─────────────────────────────────────────────────────┐
│  Capa de Presentación                               │
│  HTML5 · CSS3 (propio) · JavaScript · Jinja2        │
├─────────────────────────────────────────────────────┤
│  Capa Lógica (Backend)                              │
│  Python · Flask · Rutas REST · Sesiones · Roles     │
├─────────────────────────────────────────────────────┤
│  Capa de Datos                                      │
│  MySQL · Modelo Relacional · JSON para Big Data     │
└─────────────────────────────────────────────────────┘
```

- **Presentación:** Interfaz responsiva construida desde cero con CSS propio (sin Bootstrap). Incluye efectos de glassmorphism, micro-animaciones y una paleta clínica teal/slate.
- **Lógica:** Flask gestiona rutas, validaciones, control de sesiones y expone endpoints API REST. El decorador `@login_required` protege todas las vistas privadas.
- **Datos:** MySQL almacena pacientes, tutores, historiales, documentos, cálculos anestésicos y logs de auditoría. Las columnas `JSON` permiten almacenamiento estructurado. Cuenta con un mecanismo de **Fallback a SQLite** automático, lo que asegura que la aplicación pueda ejecutarse para evaluación académica en entornos sin servidor MySQL configurado.

---

## Tecnologías Utilizadas

| Capa | Tecnología |
| --- | --- |
| Backend | Python 3.10+ + Flask |
| Base de Datos | MySQL (via `mysql-connector-python`) con Fallback a SQLite |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Templating | Jinja2 (integrado en Flask) |
| Seguridad | Werkzeug (`generate_password_hash`) |
| Entorno | `python-dotenv` |
| API | REST (JSON) con operaciones CRUD completas |

---

## Módulos Integrados

### 📝 VetScribe
Módulo de documentación clínica integrado como vista nativa de Flask. Permite:
- Seleccionar paciente desde la base clínica común.
- Construir y gestionar recetas médicas con lista de medicamentos.
- Generar recetas y certificados en formato PDF (via `jsPDF`).
- Guardar el documento en el historial clínico del paciente.

### 💉 SafeAnesthesia
Módulo de cálculo anestésico integrado como vista nativa de Flask. Permite:
- Seleccionar paciente y autocompletar especie.
- Calcular protocolos de premedicación, inducción y mantenimiento TIVA.
- Aplicar ajustes automáticos de dosis según estado ASA y comorbilidades.
- Calcular dosis seguras de bloqueo regional (Lidocaína, Bupivacaína).
- Generar e imprimir el protocolo en PDF.
- Guardar el protocolo en el historial clínico del paciente.

### 👥 Gestión Clínica (CRUD)
Módulo base de administración que permite:
- Operaciones completas CRUD (Crear, Leer, Actualizar, Eliminar) de pacientes y tutores a través de la API REST.
- Listado y búsqueda avanzada en la base de datos de pacientes.
- Módulo de gestión de usuarios para crear, listar y eliminar cuentas del personal clínico (exclusivo para Administrador Veterinario).

---

## Seguridad Implementada

| Mecanismo | Implementación |
| --- | --- |
| Autenticación | Login único con validación por email/contraseña |
| Contraseñas | Hasheadas con `Werkzeug.security.generate_password_hash` |
| Sesiones | `flask.session` con `SECRET_KEY` desde `.env` |
| Control de acceso | Decorador `@login_required` en todas las rutas privadas |
| Roles (RBAC) | Control de acceso integrado mediante la columna `role` ('admin', 'assistant') en la tabla `users` |
| Protección | Rutas sensibles protegidas en el backend contra accesos no autorizados |
| Credenciales | Variables de entorno vía `.env` (nunca hardcodeadas en el código) |
| API REST | Validaciones de entrada en todos los endpoints; errores SQL no expuestos al cliente |

---

## Auditoría y Trazabilidad

La plataforma cuenta con un **módulo visual de auditoría** exclusivo para el rol de Administrador. Los eventos registrados en la tabla `logs_sistema` aseguran la trazabilidad de la plataforma, incluyendo:
- **Usuario responsable** de la acción.
- **Fecha y hora exacta** del suceso.
- **Acción realizada** (ej. INICIO_SESION, LOGIN_FALLIDO).
- **IP de origen** de la petición.

---

## Base de Datos Clínica

El esquema principal de la base de datos se encuentra ubicado en el archivo `database/schema.sql`. Implementa un modelo relacional normalizado con un diseño de **MySQL principal + SQLite fallback**.

### Modelo Relacional (Llaves Primarias y Foráneas)
```text
users (PK)
tutores (PK) ──< pacientes (PK, FK: tutor_id) ──< historial (PK, FK: paciente_id, usuario_id)
                                              ──< documentos (PK, FK: paciente_id, usuario_id)
                                              ──< calculos_anestesia (PK, FK: paciente_id, usuario_id)
logs_sistema (PK, FK: usuario_id)
```

| Tabla | Propósito |
| --- | --- |
| `users` | Cuentas del personal clínico (incluye columna `role`) |
| `tutores` | Propietarios de las mascotas |
| `pacientes` | Registro central de animales atendidos |
| `historial` | Consultas y atenciones clínicas generales |
| `documentos` | Recetas y certificados generados por VetScribe |
| `calculos_anestesia` | Protocolos generados por SafeAnesthesia |
| `logs_sistema` | Auditoría y trazabilidad de seguridad |

### Preparación para Big Data
Las tablas `documentos` y `calculos_anestesia` utilizan columnas de tipo `JSON` para almacenar los datos estructurados completos de cada evento clínico. Esto permite:
- **Almacenamiento histórico escalable** sin necesidad de alterar el esquema relacional.
- **Análisis estadístico futuro** e integración con herramientas de BI (Power BI, Tableau) o frameworks de ML.

---

## Instalación

### Requisitos Previos
- Python 3.10+
- MySQL Server 8.0+ (Opcional gracias al Fallback automático a SQLite)

### Instalación Paso a Paso

```bash
# 1. Clonar el repositorio
git clone https://github.com/Felipe16051975/PartenVet.git
cd PartenVet

# 2. Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno
cp .env.example .env
# Edite .env con sus credenciales de MySQL (o deje en blanco para usar SQLite)

# 5. Ejecutar la aplicación
python app.py
```

Acceder en el navegador: <http://localhost:5000>

---

## Estructura del Proyecto

```text
PartenVet/
├── app.py                  # Aplicación Flask principal (rutas, API, sesiones)
├── requirements.txt        # Dependencias Python
├── .env.example            # Plantilla de variables de entorno
├── .gitignore
├── README.md
├── database/
│   └── schema.sql          # Esquema completo de la base de datos (MySQL/SQLite)
├── static/
│   ├── css/
│   │   ├── variables.css   # Design tokens globales (colores, espaciado)
│   │   ├── main.css        # Estilos base y componentes
│   │   ├── auth.css        # Estilos del login
│   │   └── dashboard.css   # Estilos del dashboard y vistas de pacientes
│   └── js/
│       ├── api.js          # Cliente HTTP centralizado (fetch API)
│       ├── auth.js         # Lógica de autenticación frontend
│       ├── patients.js     # Lógica de base de datos clínica
│       ├── safeanesth.js   # Motor de cálculo anestésico (SafeAnesthesia)
│       └── vetscribe.js    # Lógica de generación de documentos (VetScribe)
└── templates/
    ├── base.html           # Plantilla base con navbar y footer
    ├── login.html          # Pantalla de inicio de sesión
    ├── dashboard.html      # Panel principal (Launcher)
    ├── patients/
    │   ├── list.html       # Listado y búsqueda de pacientes
    │   └── register.html   # Registro de nuevo paciente
    └── modules/
        ├── vetscribe.html  # Módulo VetScribe
        └── safeanesth.html # Módulo SafeAnesthesia
```

---

## Objetivos Académicos Cumplidos

| Criterio IPLACEX | Implementación |
| --- | --- |
| Framework web (Flask) | ✅ Rutas, plantillas Jinja2, sesiones |
| Base de datos relacional | ✅ Esquema normalizado, PK/FK, MySQL + SQLite |
| CSS propio (sin Bootstrap)| ✅ Sistema de design tokens con variables CSS |
| Modularidad | ✅ VetScribe y SafeAnesthesia como módulos nativos |
| Ciberseguridad | ✅ Hashing, RBAC, protección en backend, logs, `.env` |
| API REST | ✅ Endpoints JSON para pacientes, documentos y cálculos |
| Escalabilidad (Big Data) | ✅ Columnas JSON para análisis futuro |

---

## Checklist de entrega IPLACEX

- [x] Informe final
- [x] Presentación PPTX
- [x] Repositorio público
- [x] Frontend incluido
- [x] Backend incluido
- [x] Estructura BD incluida
- [x] Hosting gratuito
- [x] Credenciales 2 perfiles
- [x] README actualizado

---

## Aviso Legal

> Esta plataforma es una herramienta de **apoyo clínico para uso académico**. No reemplaza el criterio profesional del médico veterinario tratante. Siempre verifique dosis y diagnósticos con el especialista.

---

PartenVet © 2026 – Proyecto de Titulación IPLACEX
