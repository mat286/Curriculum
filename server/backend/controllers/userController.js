import { pool } from '../config/db.js';
import { indexUserData } from '../services/embeddingService.js';
import { ValidationError, AuthError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';

function validateUserId(paramId, authUserId) {
    const userId = parseInt(paramId, 10);
    if (isNaN(userId) || userId <= 0) throw new ValidationError('ID de usuario inválido');
    if (authUserId !== userId) throw new AuthError('Solo puedes acceder a tus propios datos');
    return userId;
}

/**
 * GET /api/user/:id — Datos completos del perfil
 */
export async function getProfile(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const { getFullProfile } = await import('../services/dataService.js');
        const userData = await getFullProfile(userId);

        if (!userData) throw new NotFoundError('Usuario no encontrado');
        res.json(userData);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/user/:id/data — Datos básicos del usuario
 */
export async function getBasicData(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);

        const [usuario] = await pool.query(
            `SELECT id, nombre, apellido, email, telefono, fecha_nacimiento, nacionalidad, direccion, resumen,
                puesto_actual, objetivo_profesional, disponibilidad, modalidad_preferida, pretension_salarial,
                linkedin_url, github_url, portfolio_url, is_public
             FROM usuarios WHERE id = ?`,
            [userId]
        );
        if (usuario.length === 0) throw new NotFoundError('Usuario no encontrado');

        const [sobreMi] = await pool.query('SELECT descripcion FROM sobre_mi WHERE user_id = ?', [userId]);

        res.json({ ...usuario[0], sobreMi: sobreMi[0]?.descripcion || '' });
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/user/:id/data — Actualiza todos los datos del perfil (transaccional)
 */
export async function updateProfile(req, res, next) {
    try {
        const finalUserId = validateUserId(req.params.id, req.user.id);

        const {
            nombre = '', apellido = '', email = '', telefono = '', fechaNacimiento = '',
            nacionalidad = '', direccion = '', resumen = '', puestoActual = '',
            objetivoProfesional = '', disponibilidad = '', modalidadPreferida = '',
            pretensionSalarial = '', linkedinUrl = '', githubUrl = '', portfolioUrl = '',
            isPublic = false,
            sobreMi = '', experiencias = [], estudios = [], cursos = [], proyectos = [],
            habilidades = [], idiomas = [], familia = {}, respuestas = [],
        } = req.body;

        const conn = await pool.getConnection();

        const insertMany = async (table, columns, rows) => {
            if (!rows || rows.length === 0) return { affectedRows: 0 };
            const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
            const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`;
            const values = rows.flat();
            const [result] = await conn.query(sql, values);
            return result;
        };

        const normalizeText = (value) => typeof value === 'string' ? value.trim() : '';
        const normalizeNullableText = (value) => {
            const text = typeof value === 'string' ? value.trim() : value;
            return text === '' || typeof text === 'undefined' ? null : text;
        };
        const normalizeNullableInt = (value) => {
            if (value === null || typeof value === 'undefined' || value === '') return null;
            const parsed = Number.parseInt(value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        };
        const normalizeNullableDate = (value) => {
            const text = normalizeNullableText(value);
            return text ? String(text).slice(0, 10) : null;
        };

        try {
            await conn.beginTransaction();

            // 1. Datos principales del CV
            await conn.query(
                `UPDATE usuarios SET
                    nombre = ?,
                    apellido = ?,
                    email = COALESCE(NULLIF(?, ''), email),
                    telefono = ?,
                    fecha_nacimiento = ?,
                    nacionalidad = ?,
                    direccion = ?,
                    resumen = ?,
                    puesto_actual = ?,
                    objetivo_profesional = ?,
                    disponibilidad = ?,
                    modalidad_preferida = ?,
                    pretension_salarial = ?,
                    linkedin_url = ?,
                    github_url = ?,
                    portfolio_url = ?,
                    is_public = ?
                 WHERE id = ?`,
                [
                    normalizeText(nombre),
                    normalizeText(apellido),
                    normalizeText(email),
                    normalizeNullableText(telefono),
                    normalizeNullableDate(fechaNacimiento),
                    normalizeNullableText(nacionalidad),
                    normalizeNullableText(direccion),
                    normalizeNullableText(resumen),
                    normalizeNullableText(puestoActual),
                    normalizeNullableText(objetivoProfesional),
                    normalizeNullableText(disponibilidad),
                    normalizeNullableText(modalidadPreferida),
                    normalizeNullableText(pretensionSalarial),
                    normalizeNullableText(linkedinUrl),
                    normalizeNullableText(githubUrl),
                    normalizeNullableText(portfolioUrl),
                    isPublic ? 1 : 0,
                    finalUserId,
                ]
            );

            // 2. Sobre mí
            await conn.query('DELETE FROM sobre_mi WHERE user_id = ?', [finalUserId]);
            if (sobreMi && String(sobreMi).trim() !== '') {
                await conn.query('INSERT INTO sobre_mi (user_id, descripcion) VALUES (?, ?)', [finalUserId, sobreMi]);
            }

            // 3. Experiencia laboral
            await conn.query('DELETE FROM experiencia_laboral WHERE user_id = ?', [finalUserId]);
            const expRows = (experiencias || []).map(exp => [
                finalUserId, exp.empresa || exp.titulo || '', exp.puesto || exp.subtitulo || '',
                exp.descripcion || exp.detalle || '', exp.fecha_inicio || exp.inicio || null,
                exp.fecha_fin || exp.fin || null, exp.actualmente ? 1 : 0,
            ]);
            await insertMany('experiencia_laboral',
                ['user_id', 'empresa', 'puesto', 'descripcion', 'fecha_inicio', 'fecha_fin', 'actualmente'], expRows);

            // 4. Educación
            await conn.query('DELETE FROM educacion WHERE user_id = ?', [finalUserId]);
            const eduRows = (estudios || []).map(est => [
                finalUserId, est.institucion || '', est.titulo || '',
                est.nivel || null, est.fecha_inicio || est.inicio || null, est.fecha_fin || est.fin || null,
            ]);
            await insertMany('educacion', ['user_id', 'institucion', 'titulo', 'nivel', 'fecha_inicio', 'fecha_fin'], eduRows);

            // 5. Cursos
            await conn.query('DELETE FROM cursos WHERE user_id = ?', [finalUserId]);
            const cursoRows = (cursos || []).map(c => [
                finalUserId, c.nombre || c.titulo || '', c.institucion || '', c.descripcion || '',
                c.fecha_inicio || c.inicio || null, c.fecha_fin || c.fin || null, c.certificado_url || null,
            ]);
            await insertMany('cursos',
                ['user_id', 'nombre', 'institucion', 'descripcion', 'fecha_inicio', 'fecha_fin', 'certificado_url'], cursoRows);

            // 6. Proyectos
            await conn.query('DELETE FROM proyectos WHERE user_id = ?', [finalUserId]);
            const projRows = (proyectos || []).map(p => [
                finalUserId, p.nombre || p.titulo || '', p.descripcion || '',
                Array.isArray(p.tecnologias) ? p.tecnologias.join(', ') : p.tecnologias || '',
                p.url || null, p.fecha_inicio || null, p.fecha_fin || null,
            ]);
            await insertMany('proyectos',
                ['user_id', 'nombre', 'descripcion', 'tecnologias', 'url', 'fecha_inicio', 'fecha_fin'], projRows);

            // 7. Habilidades
            await conn.query('DELETE FROM habilidades WHERE user_id = ?', [finalUserId]);
            const skillRows = (habilidades || []).map(skill => [
                finalUserId,
                skill.nombre || skill.titulo || '',
                skill.categoria || '',
                skill.nivel || skill.descripcion || null,
            ]);
            await insertMany('habilidades', ['user_id', 'nombre', 'categoria', 'nivel'], skillRows);

            // 8. Idiomas
            await conn.query('DELETE FROM idiomas WHERE user_id = ?', [finalUserId]);
            const languageRows = (idiomas || []).map(language => [
                finalUserId,
                language.idioma || language.titulo || '',
                language.nivel || language.descripcion || null,
            ]);
            await insertMany('idiomas', ['user_id', 'idioma', 'nivel'], languageRows);

            // 9. Familia
            await conn.query('DELETE FROM familia WHERE user_id = ?', [finalUserId]);
            const normalizeBooleanField = (value) => {
                if (value === null || typeof value === 'undefined' || value === '') return null;
                if (typeof value === 'boolean') return value ? 1 : 0;
                if (typeof value === 'number') return value === 1 ? 1 : 0;

                const normalizedValue = String(value).trim().toLowerCase();
                if (['1', 'true', 'si', 'sí', 'yes'].includes(normalizedValue)) return 1;
                if (['0', 'false', 'no'].includes(normalizedValue)) return 0;
                return null;
            };

            const familiaData = {
                vive_con_padres: normalizeBooleanField(
                    familia.vive_con_padres ?? familia.padresViven ?? familia.vivenJuntos
                ),
                cantidad_hermanos: normalizeNullableInt(familia.cantidad_hermanos ?? familia.hermanos),
                estado_civil: normalizeNullableText(familia.estadoCivil || familia.estado_civil),
                hijos: normalizeNullableInt(familia.hijos),
                observaciones: normalizeNullableText(familia.observaciones),
            };
            const hasFamilyData = Object.values(familiaData).some(value => value !== null && value !== '');
            if (hasFamilyData) {
                await conn.query(
                    'INSERT INTO familia (user_id, vive_con_padres, cantidad_hermanos, estado_civil, hijos, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
                    [finalUserId, familiaData.vive_con_padres, familiaData.cantidad_hermanos,
                        familiaData.estado_civil, familiaData.hijos, familiaData.observaciones]);
            }

            // 10. Respuestas entrevista / FAQ personalizadas
            await conn.query('DELETE FROM respuestas_entrevista WHERE user_id = ?', [finalUserId]);
            const respRows = (respuestas || []).map(r => [
                finalUserId,
                normalizeText(r.pregunta || ''),
                normalizeText(r.respuesta || ''),
            ]).filter(([, pregunta, respuesta]) => pregunta || respuesta);
            await insertMany('respuestas_entrevista', ['user_id', 'pregunta', 'respuesta'], respRows);

            await conn.commit();

            // Reindexar embeddings en background (no bloqueante)
            indexUserData(finalUserId).catch(err =>
                logger.warn({ err, userId: finalUserId }, 'Error reindexando embeddings post-actualización')
            );

            res.json({ success: true, userId: finalUserId, updated: true, message: 'Datos actualizados correctamente' });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        next(error);
    }
}
