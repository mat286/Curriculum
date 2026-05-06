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
    role ENUM('candidate', 'recruiter') NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ============================================
-- Tabla: refresh_tokens
-- Rotación y revocación de sesiones JWT
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    device_hint VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id_active (user_id, revoked_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_experiencia_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_educacion_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_cursos_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_proyectos_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_idiomas_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_habilidades_user_created (user_id, created_at)
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
    INDEX idx_user_id (user_id),
    INDEX idx_respuestas_user_created (user_id, created_at)
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
    INDEX idx_candidate_memory_candidate_updated (candidate_id, updated_at),
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
    INDEX idx_candidate_faq_active_priority_updated (candidate_id, is_active, priority, updated_at),
    INDEX idx_candidate_faq_priority_updated (candidate_id, priority, updated_at),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabla: embedding_documents
-- Metadata durable por chunk indexado en Chroma
-- ============================================
CREATE TABLE IF NOT EXISTS embedding_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    doc_key VARCHAR(191) NOT NULL,
    section_type VARCHAR(80) NOT NULL,
    source_table VARCHAR(80) NOT NULL,
    source_row_id INT DEFAULT NULL,
    content_hash CHAR(64) NOT NULL,
    content_preview VARCHAR(512) DEFAULT NULL,
    token_estimate INT UNSIGNED NOT NULL DEFAULT 0,
    embedding_model VARCHAR(120) NOT NULL,
    embedding_provider VARCHAR(60) NOT NULL,
    collection_name VARCHAR(120) NOT NULL,
    chroma_doc_id VARCHAR(191) NOT NULL,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uk_embedding_doc_candidate_key_hash (candidate_id, doc_key, content_hash),
    UNIQUE KEY uk_embedding_doc_candidate_chroma (candidate_id, chroma_doc_id),
    INDEX idx_embedding_doc_candidate_active (candidate_id, is_active),
    INDEX idx_embedding_doc_candidate_section_active (candidate_id, section_type, is_active, updated_at),
    INDEX idx_embedding_doc_candidate_hash_active (candidate_id, content_hash, is_active),
    INDEX idx_embedding_doc_candidate_source (candidate_id, source_table, source_row_id),
    INDEX idx_embedding_doc_candidate_updated (candidate_id, updated_at),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabla: embedding_index_jobs
-- Cola durable para reindexaciones/invalidez
-- ============================================
CREATE TABLE IF NOT EXISTS embedding_index_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    reason VARCHAR(80) NOT NULL,
    status ENUM('pending', 'running', 'done', 'error') NOT NULL DEFAULT 'pending',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    payload_json JSON DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL DEFAULT NULL,
    finished_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_embedding_jobs_status_created (status, created_at),
    INDEX idx_embedding_jobs_candidate (candidate_id),
    INDEX idx_embedding_jobs_candidate_status_created (candidate_id, status, created_at),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabla: embedding_query_telemetry
-- Telemetría de consultas vectoriales/híbridas para p50/p95
-- ============================================
CREATE TABLE IF NOT EXISTS embedding_query_telemetry (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    candidate_id INT NOT NULL,
    query_hash CHAR(64) NOT NULL,
    top_k SMALLINT UNSIGNED NOT NULL,
    method VARCHAR(40) NOT NULL,
    duration_ms INT UNSIGNED NOT NULL,
    hit_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_embedding_telemetry_created (created_at),
    INDEX idx_embedding_telemetry_method_created (method, created_at),
    INDEX idx_embedding_telemetry_created_method (created_at, method),
    INDEX idx_embedding_telemetry_candidate_created (candidate_id, created_at),
    INDEX idx_embedding_telemetry_duration_created (duration_ms, created_at),
    INDEX idx_embedding_telemetry_hash_created (query_hash, created_at),
    FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
