-- ============================================
-- Schema: entrevistas_virtuales
-- CV Conversacional con IA
-- ============================================

CREATE DATABASE IF NOT EXISTS entrevistas_virtuales
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE entrevistas_virtuales;

-- ============================================
-- Tabla: usuarios (datos personales principales)
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL DEFAULT '',
    apellido VARCHAR(100) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL UNIQUE,
    telefono VARCHAR(50) DEFAULT NULL,
    fecha_nacimiento DATE DEFAULT NULL,
    nacionalidad VARCHAR(100) DEFAULT NULL,
    direccion VARCHAR(255) DEFAULT NULL,
    resumen TEXT DEFAULT NULL,
    puesto_actual VARCHAR(150) DEFAULT NULL,
    objetivo_profesional TEXT DEFAULT NULL,
    disponibilidad VARCHAR(100) DEFAULT NULL,
    modalidad_preferida VARCHAR(100) DEFAULT NULL,
    pretension_salarial VARCHAR(100) DEFAULT NULL,
    linkedin_url VARCHAR(500) DEFAULT NULL,
    github_url VARCHAR(500) DEFAULT NULL,
    portfolio_url VARCHAR(500) DEFAULT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    profile_photo_url VARCHAR(500) DEFAULT NULL,
    onboarding_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
    onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: sobre_mi (descripción personal)
-- ============================================
CREATE TABLE IF NOT EXISTS sobre_mi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: experiencia_laboral
-- ============================================
CREATE TABLE IF NOT EXISTS experiencia_laboral (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    empresa VARCHAR(200) NOT NULL DEFAULT '',
    puesto VARCHAR(200) NOT NULL DEFAULT '',
    descripcion TEXT DEFAULT NULL,
    fecha_inicio DATE DEFAULT NULL,
    fecha_fin DATE DEFAULT NULL,
    actualmente TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: educacion
-- ============================================
CREATE TABLE IF NOT EXISTS educacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    institucion VARCHAR(200) NOT NULL DEFAULT '',
    titulo VARCHAR(200) NOT NULL DEFAULT '',
    nivel VARCHAR(100) DEFAULT NULL,
    fecha_inicio DATE DEFAULT NULL,
    fecha_fin DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: cursos
-- ============================================
CREATE TABLE IF NOT EXISTS cursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL DEFAULT '',
    institucion VARCHAR(200) DEFAULT '',
    descripcion TEXT DEFAULT NULL,
    fecha_inicio DATE DEFAULT NULL,
    fecha_fin DATE DEFAULT NULL,
    certificado_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: proyectos
-- ============================================
CREATE TABLE IF NOT EXISTS proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL DEFAULT '',
    descripcion TEXT DEFAULT NULL,
    tecnologias VARCHAR(500) DEFAULT '',
    url VARCHAR(500) DEFAULT NULL,
    fecha_inicio DATE DEFAULT NULL,
    fecha_fin DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: familia
-- ============================================
CREATE TABLE IF NOT EXISTS familia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vive_con_padres TINYINT(1) DEFAULT NULL,
    cantidad_hermanos INT DEFAULT NULL,
    estado_civil VARCHAR(50) DEFAULT NULL,
    hijos INT DEFAULT NULL,
    observaciones TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: idiomas
-- ============================================
CREATE TABLE IF NOT EXISTS idiomas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    idioma VARCHAR(100) NOT NULL DEFAULT '',
    nivel VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: habilidades
-- ============================================
CREATE TABLE IF NOT EXISTS habilidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL DEFAULT '',
    categoria VARCHAR(100) DEFAULT NULL,
    nivel VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: respuestas_entrevista
-- ============================================
CREATE TABLE IF NOT EXISTS respuestas_entrevista (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: candidate_context_snapshot
-- Snapshot compilado del perfil para chat/RAG
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_context_snapshot (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    snapshot_json JSON NOT NULL,
    compiled_context MEDIUMTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_candidate_snapshot_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabla: candidate_conversation_memory
-- Memoria corta por sesión/candidato
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_conversation_memory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_key VARCHAR(191) NOT NULL,
    candidate_id INT NOT NULL,
    requester_id INT DEFAULT NULL,
    summary TEXT DEFAULT NULL,
    last_messages JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_candidate_memory_session (session_key),
    INDEX idx_candidate_memory_candidate (candidate_id),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabla: candidate_faqs
-- FAQs personalizadas del candidato con embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS candidate_faqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding JSON DEFAULT NULL,
    embedding_model VARCHAR(120) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    priority INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_candidate_faq_candidate_active (candidate_id, is_active),
    INDEX idx_candidate_faq_candidate_priority (candidate_id, priority),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
