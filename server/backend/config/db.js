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
        CONSTRAINT fk_candidate_faq_candidate FOREIGN KEY (candidate_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    `,
];

export async function ensureProfileSchema() {
    for (const statement of PROFILE_SCHEMA_STATEMENTS) {
        try {
            await pool.query(statement);
        } catch (error) {
            if (error?.code !== 'ER_DUP_FIELDNAME') {
                throw error;
            }
        }
    }

    for (const statement of CHAT_SCHEMA_STATEMENTS) {
        await pool.query(statement);
    }

    logger.info('Esquema de perfil verificado');
}

export { pool };
