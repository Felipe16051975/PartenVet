-- PartenVet — Esquema de base de datos
-- Versión 1.0 | Proyecto de Titulación IPLACEX
--
-- Uso con MySQL:
--   CREATE DATABASE IF NOT EXISTS partenvet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE partenvet_db;
--   SOURCE database/schema.sql;
--
-- Con SQLite la aplicación convierte la sintaxis automáticamente.


-- Roles de usuario
CREATE TABLE IF NOT EXISTS roles (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario    INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    correo        VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol_id        INT          NOT NULL,
    estado        ENUM('activo', 'inactivo') DEFAULT 'activo',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- Tutores (propietarios)
CREATE TABLE IF NOT EXISTS tutores (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    rut_dni    VARCHAR(20) UNIQUE,
    nombres    VARCHAR(100) NOT NULL,
    apellidos  VARCHAR(100) NOT NULL,
    telefono   VARCHAR(20),
    correo     VARCHAR(100),
    direccion  VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Pacientes (mascotas)
CREATE TABLE IF NOT EXISTS pacientes (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id         INT          NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    especie          VARCHAR(50)  NOT NULL,   -- 'Canino', 'Felino', 'Exótico'
    raza             VARCHAR(100),
    sexo             ENUM('M', 'H'),
    fecha_nacimiento DATE,
    peso_actual      DECIMAL(5,2),            -- kg
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE
);

-- Historial clínico
CREATE TABLE IF NOT EXISTS historial (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id      INT NOT NULL,
    usuario_id       INT NOT NULL,
    motivo_consulta  VARCHAR(255),
    anamnesis        TEXT,
    diagnostico      TEXT,
    tratamiento      TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
);

-- Documentos generados por VetScribe
CREATE TABLE IF NOT EXISTS documentos (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id      INT NOT NULL,
    usuario_id       INT NOT NULL,
    tipo_documento   ENUM('Receta', 'Certificado', 'Orden de Examen', 'Receta Magistral') NOT NULL,
    contenido_json   JSON,
    ruta_archivo     VARCHAR(255),
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
);

-- Protocolos anestésicos generados por SafeAnesthesia
CREATE TABLE IF NOT EXISTS calculos_anestesia (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id     INT           NOT NULL,
    usuario_id      INT           NOT NULL,
    peso_utilizado  DECIMAL(5,2)  NOT NULL,
    riesgo_asa      ENUM('I', 'II', 'III', 'IV', 'V') NOT NULL,
    protocolo_json  JSON,
    fecha_calculo   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
);

-- Log de accesos y acciones
CREATE TABLE IF NOT EXISTS logs_sistema (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id  INT,                    -- NULL en intentos de login fallidos
    accion      VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ip_origen   VARCHAR(45),            -- IPv4 e IPv6
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);


-- Roles iniciales
INSERT IGNORE INTO roles (nombre, descripcion) VALUES
    ('Administrador Veterinario', 'Acceso total al sistema'),
    ('Usuario Asistente', 'Acceso limitado: pacientes e historial');

-- Índices
CREATE INDEX idx_pacientes_tutor   ON pacientes(tutor_id);
CREATE INDEX idx_historial_paciente ON historial(paciente_id);
CREATE INDEX idx_documentos_paciente ON documentos(paciente_id);
CREATE INDEX idx_calculos_paciente  ON calculos_anestesia(paciente_id);
CREATE INDEX idx_logs_usuario       ON logs_sistema(usuario_id);
CREATE INDEX idx_logs_accion        ON logs_sistema(accion);

-- Usuarios de demostración (contraseña: admin123)
-- Hash generado con werkzeug.security.generate_password_hash('admin123')
INSERT IGNORE INTO usuarios (nombre, correo, password_hash, rol_id) VALUES
    ('Dr. Administrador', 'admin@partenvet.cl',
     'scrypt:32768:8:1$mSxpZFq812xZVYZ9$5b827c2477dd850a68fb38b3c1555ec86a1d4d7d4a0090984cb824252f8c1c7d88b90529c62c082e023e419e14b4cc90a42cb91ffe55ca9cf6775d8469467442',
     (SELECT id FROM roles WHERE nombre = 'Administrador Veterinario')),
    ('Asistente Clínico', 'asistente@partenvet.cl',
     'scrypt:32768:8:1$mSxpZFq812xZVYZ9$5b827c2477dd850a68fb38b3c1555ec86a1d4d7d4a0090984cb824252f8c1c7d88b90529c62c082e023e419e14b4cc90a42cb91ffe55ca9cf6775d8469467442',
     (SELECT id FROM roles WHERE nombre = 'Usuario Asistente'));
