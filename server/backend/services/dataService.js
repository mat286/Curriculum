import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

// Mapeo de campos a tablas de MySQL
const FIELD_TABLE_MAP = {
    usuarios: { table: 'usuarios', query: 'SELECT id, nombre, apellido, email, telefono, fecha_nacimiento, nacionalidad, direccion, resumen, puesto_actual, objetivo_profesional, disponibilidad, modalidad_preferida, pretension_salarial, linkedin_url, github_url, portfolio_url FROM usuarios WHERE id = ?' },
    sobre_mi: { table: 'sobre_mi', query: 'SELECT * FROM sobre_mi WHERE user_id = ?' },
    experiencia_laboral: { table: 'experiencia_laboral', query: 'SELECT * FROM experiencia_laboral WHERE user_id = ?' },
    educacion: { table: 'educacion', query: 'SELECT * FROM educacion WHERE user_id = ?' },
    cursos: { table: 'cursos', query: 'SELECT * FROM cursos WHERE user_id = ?' },
    proyectos: { table: 'proyectos', query: 'SELECT * FROM proyectos WHERE user_id = ?' },
    familia: { table: 'familia', query: 'SELECT * FROM familia WHERE user_id = ?' },
    idiomas: { table: 'idiomas', query: 'SELECT * FROM idiomas WHERE user_id = ?' },
    habilidades: { table: 'habilidades', query: 'SELECT * FROM habilidades WHERE user_id = ?' },
    respuestas_entrevista: { table: 'respuestas_entrevista', query: 'SELECT * FROM respuestas_entrevista WHERE user_id = ?' },
};

/**
 * Obtiene datos selectivos del usuario según los campos solicitados.
 * @param {number} userId
 * @param {string[]} fields - campos a consultar (ej: ['experiencia_laboral', 'habilidades'])
 * @returns {Object} Datos del usuario filtrados por campos
 */
export async function getUserData(userId, fields = []) {
    if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('ID de usuario inválido');
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // Siempre obtener datos básicos del usuario
        const [usuario] = await conn.query(FIELD_TABLE_MAP.usuarios.query, [userId]);
        if (usuario.length === 0) return null;

        const result = { usuario: usuario[0] };

        // Si no se especifican campos, devolver solo datos básicos
        if (!fields || fields.length === 0) return result;

        // Consultar solo las tablas solicitadas (en paralelo)
        const validFields = fields.filter(f => f !== 'usuarios' && FIELD_TABLE_MAP[f]);

        if (validFields.length > 0) {
            const queries = validFields.map(f =>
                conn.query(FIELD_TABLE_MAP[f].query, [userId])
            );
            const results = await Promise.all(queries);

            validFields.forEach((field, i) => {
                result[field] = results[i][0];
            });
        }

        logger.debug({ userId, fields: validFields }, 'Datos selectivos consultados');
        return result;
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Obtiene TODOS los datos del perfil de un usuario (para perfil completo / embeddings).
 */
export async function getFullProfile(userId) {
    const allFields = Object.keys(FIELD_TABLE_MAP).filter(f => f !== 'usuarios');
    return getUserData(userId, allFields);
}
