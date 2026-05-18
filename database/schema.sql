-- PartenVet — Esquema de base de datos
-- Versión 1.1 | Proyecto de Titulación IPLACEX
--

-- Usuarios del sistema (Estructura requerida para defensa)
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL, -- 'admin', 'assistant'
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    FOREIGN KEY (usuario_id)  REFERENCES users(id) ON DELETE RESTRICT
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
    FOREIGN KEY (usuario_id)  REFERENCES users(id) ON DELETE RESTRICT
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
    FOREIGN KEY (usuario_id)  REFERENCES users(id) ON DELETE RESTRICT
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
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_pacientes_tutor   ON pacientes(tutor_id);
CREATE INDEX idx_historial_paciente ON historial(paciente_id);
CREATE INDEX idx_documentos_paciente ON documentos(paciente_id);
CREATE INDEX idx_calculos_paciente  ON calculos_anestesia(paciente_id);
CREATE INDEX idx_logs_usuario       ON logs_sistema(usuario_id);
CREATE INDEX idx_logs_accion        ON logs_sistema(accion);

-- Usuarios de demostración (admin123 / asistente123)
-- Generados con generate_password_hash
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
    ('Administrador Veterinario', 'admin@partenvet.cl',
     'scrypt:32768:8:1$deientmJh8o0YEwb$7aa77a4d6133b5766c13c686ae53f510b11d607cd786d08933308fb40b70b249a50dacdd5336e6464a1bc8c9d0f557c078262edc01f38c6ac0fe65254408e1c7',
     'admin'),
    ('Asistente Clínico', 'asistente@partenvet.cl',
     'scrypt:32768:8:1$dmiM1anJDtdYYNOJ$da9e75cc1e3bb75f1ba164704ba029f0bc181d8505da782a4f4012aa828a7aa650e05ca220dcef9c43b5d80afb6373c8e6984c0fad2a7297f143ddde81503ef3',
     'assistant');

-- Tutor y Paciente de demostración
INSERT IGNORE INTO tutores (id, rut_dni, nombres, apellidos, telefono, correo, direccion) VALUES
    (1, '12345678-9', 'Juan', 'Pérez', '+56912345678', 'juan.perez@example.com', 'Av. Siempre Viva 742');

INSERT IGNORE INTO pacientes (id, tutor_id, nombre, especie, raza, sexo, fecha_nacimiento, peso_actual) VALUES
    (1, 1, 'Boby', 'Canino', 'Mestizo', 'M', '2020-01-01', 15.5);



