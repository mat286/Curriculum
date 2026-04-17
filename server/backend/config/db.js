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
    logger.info('Esquema de perfil verificado');
}

export { pool };
