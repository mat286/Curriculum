import mysql from 'mysql2/promise';
import logger from '../utils/logger.js';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'entrevistas_virtuales',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});

const PROFILE_SCHEMA_STATEMENTS = [
    'ALTER TABLE usuarios ADD COLUMN puesto_actual VARCHAR(150) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN objetivo_profesional TEXT DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN disponibilidad VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN modalidad_preferida VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN pretension_salarial VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN linkedin_url VARCHAR(500) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN github_url VARCHAR(500) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN portfolio_url VARCHAR(500) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE usuarios ADD COLUMN profile_photo_url VARCHAR(500) DEFAULT NULL',
    'ALTER TABLE usuarios ADD COLUMN onboarding_step TINYINT UNSIGNED NOT NULL DEFAULT 1',
    'ALTER TABLE usuarios ADD COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 0',
    "ALTER TABLE usuarios ADD COLUMN role ENUM('candidate', 'recruiter') NOT NULL DEFAULT 'candidate'",
];

const CHAT_SCHEMA_STATEMENTS = [
    `
    CREATE TABLE IF NOT EXISTS candidate_context_snapshot (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        snapshot_json JSON NOT NULL,
        compiled_context MEDIUMTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_candidate_snapshot_user_id (user_id),
        CONSTRAINT fk_candidate_snapshot_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
    `
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
        CONSTRAINT fk_candidate_memory_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
    `
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
        CONSTRAINT fk_candidate_faq_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
    `
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
        CONSTRAINT fk_embedding_doc_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
    `
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
        CONSTRAINT fk_embedding_jobs_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
    `
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
        CONSTRAINT fk_embedding_telemetry_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
];

const INDEX_SCHEMA_STATEMENTS = [
    'CREATE INDEX idx_role ON usuarios(role)',
    'CREATE INDEX idx_experiencia_user_created ON experiencia_laboral(user_id, created_at)',
    'CREATE INDEX idx_educacion_user_created ON educacion(user_id, created_at)',
    'CREATE INDEX idx_cursos_user_created ON cursos(user_id, created_at)',
    'CREATE INDEX idx_proyectos_user_created ON proyectos(user_id, created_at)',
    'CREATE INDEX idx_idiomas_user_created ON idiomas(user_id, created_at)',
    'CREATE INDEX idx_habilidades_user_created ON habilidades(user_id, created_at)',
    'CREATE INDEX idx_respuestas_user_created ON respuestas_entrevista(user_id, created_at)',
    'CREATE INDEX idx_candidate_memory_candidate_updated ON candidate_conversation_memory(candidate_id, updated_at)',
    'CREATE INDEX idx_candidate_faq_active_priority_updated ON candidate_faqs(candidate_id, is_active, priority, updated_at)',
    'CREATE INDEX idx_candidate_faq_priority_updated ON candidate_faqs(candidate_id, priority, updated_at)',
    'CREATE INDEX idx_embedding_doc_candidate_active ON embedding_documents(candidate_id, is_active)',
    'CREATE INDEX idx_embedding_doc_candidate_section_active ON embedding_documents(candidate_id, section_type, is_active, updated_at)',
    'CREATE INDEX idx_embedding_doc_candidate_hash_active ON embedding_documents(candidate_id, content_hash, is_active)',
    'CREATE INDEX idx_embedding_doc_candidate_source ON embedding_documents(candidate_id, source_table, source_row_id)',
    'CREATE INDEX idx_embedding_doc_candidate_updated ON embedding_documents(candidate_id, updated_at)',
    'CREATE INDEX idx_embedding_jobs_status_created ON embedding_index_jobs(status, created_at)',
    'CREATE INDEX idx_embedding_jobs_candidate ON embedding_index_jobs(candidate_id)',
    'CREATE INDEX idx_embedding_jobs_candidate_status_created ON embedding_index_jobs(candidate_id, status, created_at)',
    'CREATE INDEX idx_embedding_telemetry_created ON embedding_query_telemetry(created_at)',
    'CREATE INDEX idx_embedding_telemetry_method_created ON embedding_query_telemetry(method, created_at)',
    'CREATE INDEX idx_embedding_telemetry_created_method ON embedding_query_telemetry(created_at, method)',
    'CREATE INDEX idx_embedding_telemetry_candidate_created ON embedding_query_telemetry(candidate_id, created_at)',
    'CREATE INDEX idx_embedding_telemetry_duration_created ON embedding_query_telemetry(duration_ms, created_at)',
    'CREATE INDEX idx_embedding_telemetry_hash_created ON embedding_query_telemetry(query_hash, created_at)',
];

const IGNORABLE_SCHEMA_ERROR_CODES = new Set(['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME']);

async function runStatementSafely(statement) {
    try {
        await pool.query(statement);
    } catch (error) {
        if (!IGNORABLE_SCHEMA_ERROR_CODES.has(error?.code)) {
            throw error;
        }
    }
}

export async function ensureProfileSchema() {
    for (const statement of PROFILE_SCHEMA_STATEMENTS) {
        await runStatementSafely(statement);
    }

    for (const statement of CHAT_SCHEMA_STATEMENTS) {
        await pool.query(statement);
    }

    for (const statement of INDEX_SCHEMA_STATEMENTS) {
        await runStatementSafely(statement);
    }

    logger.info('Esquema de perfil verificado');
}

export { pool };
