import { pool } from '../config/db.js';
import { indexUserData } from '../services/embeddingService.js';
import { ValidationError, AuthError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { getFullProfile } from '../services/dataService.js';
import { CandidateContextSnapshotService } from '../modules/candidate/CandidateContextSnapshotService.js';
import { normalizeText } from '../utils/textUtils.js';

const snapshotService = new CandidateContextSnapshotService();
const ONBOARDING_MIN_STEP = 1;
const ONBOARDING_MAX_STEP = 5;
const SECTION_KEYS = [
    'experiencia_laboral',
    'educacion',
    'cursos',
    'proyectos',
    'habilidades',
    'idiomas',
    'respuestas_entrevista',
];

function validateUserId(paramId, authUserId) {
    const userId = parseInt(paramId, 10);
    if (isNaN(userId) || userId <= 0) throw new ValidationError('ID de usuario inválido');
    if (authUserId !== userId) throw new AuthError('Solo puedes acceder a tus propios datos');
    return userId;
}

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'si', 'sí', 'yes'].includes(normalized);
}

function normalizeNullableText(value) {
    const text = typeof value === 'string' ? value.trim() : value;
    return text === '' || typeof text === 'undefined' ? null : text;
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function isValidYyyyMmDd(dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;

    const [yearRaw, monthRaw, dayRaw] = dateText.split('-');
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

function formatDateObjectAsYyyyMmDd(date) {
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function normalizeNullableDate(value, fieldName) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new ValidationError(`Formato inválido para ${fieldName}. Usa YYYY-MM-DD`);
        }

        return formatDateObjectAsYyyyMmDd(value);
    }

    const text = normalizeNullableText(value);
    if (!text) return null;

    const normalized = String(text).slice(0, 10);
    if (!isValidYyyyMmDd(normalized)) {
        throw new ValidationError(`Formato inválido para ${fieldName}. Usa YYYY-MM-DD`);
    }

    return normalized;
}

function firstDefined(...values) {
    for (const value of values) {
        if (typeof value !== 'undefined') return value;
    }
    return undefined;
}

function validateSectionKey(sectionKey) {
    if (!SECTION_KEYS.includes(sectionKey)) {
        throw new ValidationError(`sectionKey inválido. Permitidos: ${SECTION_KEYS.join(', ')}`);
    }
    return sectionKey;
}

function validateItemId(itemIdParam) {
    const itemId = Number.parseInt(itemIdParam, 10);
    if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new ValidationError('itemId inválido');
    }
    return itemId;
}

function buildCreateSectionData(sectionKey, payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('Payload inválido para la sección');
    }

    switch (sectionKey) {
    case 'experiencia_laboral': {
        const empresa = normalizeText(firstDefined(payload.empresa, payload.titulo));
        const puesto = normalizeText(firstDefined(payload.puesto, payload.subtitulo));
        if (!empresa || !puesto) throw new ValidationError('experiencia_laboral requiere empresa y puesto');
        return {
            empresa,
            puesto,
            descripcion: normalizeNullableText(firstDefined(payload.descripcion, payload.detalle)),
            fecha_inicio: normalizeNullableDate(firstDefined(payload.fecha_inicio, payload.inicio), 'fecha_inicio'),
            fecha_fin: normalizeNullableDate(firstDefined(payload.fecha_fin, payload.fin), 'fecha_fin'),
            actualmente: normalizeBoolean(payload.actualmente) ? 1 : 0,
        };
    }
    case 'educacion': {
        const institucion = normalizeText(payload.institucion);
        const titulo = normalizeText(payload.titulo);
        if (!institucion || !titulo) throw new ValidationError('educacion requiere institucion y titulo');
        return {
            institucion,
            titulo,
            nivel: normalizeNullableText(payload.nivel),
            fecha_inicio: normalizeNullableDate(firstDefined(payload.fecha_inicio, payload.inicio), 'fecha_inicio'),
            fecha_fin: normalizeNullableDate(firstDefined(payload.fecha_fin, payload.fin), 'fecha_fin'),
        };
    }
    case 'cursos': {
        const nombre = normalizeText(firstDefined(payload.nombre, payload.titulo));
        if (!nombre) throw new ValidationError('cursos requiere nombre');
        return {
            nombre,
            institucion: normalizeNullableText(payload.institucion),
            descripcion: normalizeNullableText(payload.descripcion),
            fecha_inicio: normalizeNullableDate(firstDefined(payload.fecha_inicio, payload.inicio), 'fecha_inicio'),
            fecha_fin: normalizeNullableDate(firstDefined(payload.fecha_fin, payload.fin), 'fecha_fin'),
            certificado_url: normalizeNullableText(payload.certificado_url),
        };
    }
    case 'proyectos': {
        const nombre = normalizeText(firstDefined(payload.nombre, payload.titulo));
        if (!nombre) throw new ValidationError('proyectos requiere nombre');
        return {
            nombre,
            descripcion: normalizeNullableText(payload.descripcion),
            tecnologias: normalizeNullableText(
                Array.isArray(payload.tecnologias) ? payload.tecnologias.join(', ') : payload.tecnologias
            ),
            url: normalizeNullableText(payload.url),
            fecha_inicio: normalizeNullableDate(firstDefined(payload.fecha_inicio, payload.inicio), 'fecha_inicio'),
            fecha_fin: normalizeNullableDate(firstDefined(payload.fecha_fin, payload.fin), 'fecha_fin'),
        };
    }
    case 'habilidades': {
        const nombre = normalizeText(firstDefined(payload.nombre, payload.titulo));
        if (!nombre) throw new ValidationError('habilidades requiere nombre');
        return {
            nombre,
            categoria: normalizeNullableText(payload.categoria),
            nivel: normalizeNullableText(firstDefined(payload.nivel, payload.descripcion)),
        };
    }
    case 'idiomas': {
        const idioma = normalizeText(firstDefined(payload.idioma, payload.titulo));
        if (!idioma) throw new ValidationError('idiomas requiere idioma');
        return {
            idioma,
            nivel: normalizeNullableText(firstDefined(payload.nivel, payload.descripcion)),
        };
    }
    case 'respuestas_entrevista': {
        const pregunta = normalizeText(payload.pregunta);
        const respuesta = normalizeText(payload.respuesta);
        if (!pregunta || !respuesta) {
            throw new ValidationError('respuestas_entrevista requiere pregunta y respuesta');
        }
        return { pregunta, respuesta };
    }
    default:
        throw new ValidationError('sectionKey inválido');
    }
}

function buildUpdateSectionData(sectionKey, payload = {}, current = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('Payload inválido para la sección');
    }

    const merged = {
        ...current,
        ...payload,
    };

    return buildCreateSectionData(sectionKey, merged);
}

function getSectionDefinition(sectionKey) {
    const definitions = {
        experiencia_laboral: {
            table: 'experiencia_laboral',
            columns: ['empresa', 'puesto', 'descripcion', 'fecha_inicio', 'fecha_fin', 'actualmente'],
        },
        educacion: {
            table: 'educacion',
            columns: ['institucion', 'titulo', 'nivel', 'fecha_inicio', 'fecha_fin'],
        },
        cursos: {
            table: 'cursos',
            columns: ['nombre', 'institucion', 'descripcion', 'fecha_inicio', 'fecha_fin', 'certificado_url'],
        },
        proyectos: {
            table: 'proyectos',
            columns: ['nombre', 'descripcion', 'tecnologias', 'url', 'fecha_inicio', 'fecha_fin'],
        },
        habilidades: {
            table: 'habilidades',
            columns: ['nombre', 'categoria', 'nivel'],
        },
        idiomas: {
            table: 'idiomas',
            columns: ['idioma', 'nivel'],
        },
        respuestas_entrevista: {
            table: 'respuestas_entrevista',
            columns: ['pregunta', 'respuesta'],
        },
    };

    return definitions[sectionKey];
}

function triggerProfileRefreshAndReindex(userId) {
    getFullProfile(userId)
        .then(profile => snapshotService.upsertSnapshot(userId, profile))
        .catch(err => logger.warn({ err, userId }, 'Error actualizando snapshot de candidato'));

    indexUserData(userId).catch(err =>
        logger.warn({ err, userId }, 'Error reindexando embeddings post-actualización')
    );
}

function mapUserForClient(userRow) {
    return {
        id: userRow.id,
        nombre: userRow.nombre || '',
        apellido: userRow.apellido || '',
        email: userRow.email || '',
        puesto_actual: userRow.puesto_actual || '',
        puestoActual: userRow.puesto_actual || '',
        resumen: userRow.resumen || '',
        is_public: userRow.is_public ? 1 : 0,
        isPublic: !!userRow.is_public,
        onboarding_step: userRow.onboarding_step || 1,
        onboardingStep: userRow.onboarding_step || 1,
        onboarding_completed: userRow.onboarding_completed ? 1 : 0,
        onboardingCompleted: !!userRow.onboarding_completed,
        profile_photo_url: userRow.profile_photo_url || null,
        profilePhotoUrl: userRow.profile_photo_url || null,
    };
}

async function fetchUserOnboardingState(conn, userId) {
    const [rows] = await conn.query(
        `SELECT id, nombre, apellido, email, puesto_actual, resumen, is_public,
                onboarding_step, onboarding_completed, profile_photo_url
         FROM usuarios
         WHERE id = ?`,
        [userId]
    );

    if (rows.length === 0) throw new NotFoundError('Usuario no encontrado');
    return rows[0];
}

/**
 * GET /api/user/:id — Datos completos del perfil
 */
export async function getProfile(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
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

        const normalizeNullableInt = (value) => {
            if (value === null || typeof value === 'undefined' || value === '') return null;
            const parsed = Number.parseInt(value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        };
        const normalizeNullableDate = (value) => normalizeNullableDateLegacy(value);

        function normalizeNullableDateLegacy(input) {
            const text = normalizeNullableText(input);
            return text ? String(text).slice(0, 10) : null;
        }

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

            triggerProfileRefreshAndReindex(finalUserId);

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

/**
 * POST /api/user/:id/section/:sectionKey — Crea item en una sección de lista
 */
export async function createProfileSectionItem(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const sectionKey = validateSectionKey(req.params.sectionKey);
        const section = getSectionDefinition(sectionKey);
        const data = buildCreateSectionData(sectionKey, req.body);
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const columns = ['user_id', ...section.columns];
            const placeholders = columns.map(() => '?').join(', ');
            const values = [userId, ...section.columns.map(column => data[column] ?? null)];
            const [result] = await conn.query(
                `INSERT INTO ${section.table} (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );

            const [rows] = await conn.query(
                `SELECT * FROM ${section.table} WHERE id = ? AND user_id = ?`,
                [result.insertId, userId]
            );

            await conn.commit();
            triggerProfileRefreshAndReindex(userId);

            res.status(201).json({
                success: true,
                sectionKey,
                item: rows[0] || null,
                created: true,
            });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/user/:id/section/:sectionKey/:itemId — Actualiza item de sección
 */
export async function updateProfileSectionItem(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const sectionKey = validateSectionKey(req.params.sectionKey);
        const itemId = validateItemId(req.params.itemId);
        const section = getSectionDefinition(sectionKey);

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [existingRows] = await conn.query(
                `SELECT * FROM ${section.table} WHERE id = ? AND user_id = ?`,
                [itemId, userId]
            );
            if (existingRows.length === 0) throw new NotFoundError('Item no encontrado');

            const data = buildUpdateSectionData(sectionKey, req.body, existingRows[0]);
            const setClause = section.columns.map(column => `${column} = ?`).join(', ');
            const values = [...section.columns.map(column => data[column] ?? null), itemId, userId];

            await conn.query(
                `UPDATE ${section.table} SET ${setClause} WHERE id = ? AND user_id = ?`,
                values
            );

            const [rows] = await conn.query(
                `SELECT * FROM ${section.table} WHERE id = ? AND user_id = ?`,
                [itemId, userId]
            );

            await conn.commit();
            triggerProfileRefreshAndReindex(userId);

            res.json({
                success: true,
                sectionKey,
                item: rows[0] || null,
                updated: true,
            });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        next(error);
    }
}

/**
 * DELETE /api/user/:id/section/:sectionKey/:itemId — Elimina item de sección
 */
export async function deleteProfileSectionItem(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const sectionKey = validateSectionKey(req.params.sectionKey);
        const itemId = validateItemId(req.params.itemId);
        const section = getSectionDefinition(sectionKey);
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [result] = await conn.query(
                `DELETE FROM ${section.table} WHERE id = ? AND user_id = ?`,
                [itemId, userId]
            );
            if (result.affectedRows === 0) throw new NotFoundError('Item no encontrado');

            await conn.commit();
            triggerProfileRefreshAndReindex(userId);

            res.json({
                success: true,
                sectionKey,
                itemId,
                deleted: true,
            });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/user/:id/photo — Marca avance del paso de foto y opcionalmente guarda URL
 * Nota: para mantener compatibilidad sin dependencias extra, este endpoint no procesa binarios multipart.
 */
export async function uploadOnboardingPhoto(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const photoUrl = typeof req.body?.photoUrl === 'string' && req.body.photoUrl.trim()
            ? req.body.photoUrl.trim()
            : null;

        await pool.query(
            `UPDATE usuarios
             SET onboarding_step = GREATEST(onboarding_step, 2),
                 profile_photo_url = COALESCE(?, profile_photo_url)
             WHERE id = ?`,
            [photoUrl, userId]
        );

        const [rows] = await pool.query(
            `SELECT id, nombre, apellido, email, puesto_actual, resumen, is_public,
                    onboarding_step, onboarding_completed, profile_photo_url
             FROM usuarios
             WHERE id = ?`,
            [userId]
        );

        if (rows.length === 0) throw new NotFoundError('Usuario no encontrado');

        res.json({
            success: true,
            message: 'Paso de foto guardado correctamente',
            photoUrl: rows[0].profile_photo_url || null,
            user: mapUserForClient(rows[0]),
        });
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/user/:id/onboarding?step=N — Guarda progreso del onboarding
 */
export async function saveOnboardingStep(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const step = Number.parseInt(req.query.step, 10);

        if (!Number.isInteger(step) || step < ONBOARDING_MIN_STEP || step > ONBOARDING_MAX_STEP) {
            throw new ValidationError('Paso de onboarding inválido');
        }

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            if (step === 3) {
                const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
                const puestoActual = typeof req.body?.puestoActual === 'string' ? req.body.puestoActual.trim() : '';
                const resumen = typeof req.body?.resumen === 'string' ? req.body.resumen.trim() : null;

                if (nombre && (nombre.length < 2 || nombre.length > 100)) {
                    throw new ValidationError('El nombre debe tener entre 2 y 100 caracteres');
                }

                if (puestoActual.length > 150) {
                    throw new ValidationError('El puesto actual no puede superar los 150 caracteres');
                }

                await conn.query(
                    `UPDATE usuarios
                     SET nombre = COALESCE(NULLIF(?, ''), nombre),
                         puesto_actual = COALESCE(NULLIF(?, ''), puesto_actual),
                         resumen = ?
                     WHERE id = ?`,
                    [nombre, puestoActual, resumen, userId]
                );
            }

            if (step === 5 && Object.prototype.hasOwnProperty.call(req.body || {}, 'isPublic')) {
                const isPublic = normalizeBoolean(req.body.isPublic);
                await conn.query('UPDATE usuarios SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, userId]);
            }

            await conn.query(
                'UPDATE usuarios SET onboarding_step = GREATEST(onboarding_step, ?) WHERE id = ?',
                [step, userId]
            );

            const userRow = await fetchUserOnboardingState(conn, userId);
            await conn.commit();

            res.json({
                success: true,
                step,
                user: mapUserForClient(userRow),
                message: 'Progreso de onboarding guardado',
            });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/user/:id/onboarding/complete — Marca onboarding como completo
 */
export async function completeOnboarding(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const hasPublicPreference = Object.prototype.hasOwnProperty.call(req.body || {}, 'isPublic');
        const isPublic = hasPublicPreference ? normalizeBoolean(req.body.isPublic) : null;

        if (hasPublicPreference) {
            await pool.query(
                `UPDATE usuarios
                 SET onboarding_completed = 1,
                     onboarding_step = ?,
                     is_public = ?
                 WHERE id = ?`,
                [ONBOARDING_MAX_STEP, isPublic ? 1 : 0, userId]
            );
        } else {
            await pool.query(
                `UPDATE usuarios
                 SET onboarding_completed = 1,
                     onboarding_step = ?
                 WHERE id = ?`,
                [ONBOARDING_MAX_STEP, userId]
            );
        }

        const [rows] = await pool.query(
            `SELECT id, nombre, apellido, email, puesto_actual, resumen, is_public,
                    onboarding_step, onboarding_completed, profile_photo_url
             FROM usuarios
             WHERE id = ?`,
            [userId]
        );

        if (rows.length === 0) throw new NotFoundError('Usuario no encontrado');

        res.json({
            success: true,
            completed: true,
            user: mapUserForClient(rows[0]),
            message: 'Onboarding completado correctamente',
        });
    } catch (error) {
        next(error);
    }
}

const VALID_ROLES = ['candidate', 'recruiter'];

export async function updateUserRole(req, res, next) {
    try {
        const userId = validateUserId(req.params.id, req.user.id);
        const { role } = req.body || {};

        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                error: 'Rol inválido',
                message: `El rol debe ser uno de: ${VALID_ROLES.join(', ')}`,
            });
        }

        await pool.query('UPDATE usuarios SET role = ? WHERE id = ?', [role, userId]);

        const [rows] = await pool.query(
            'SELECT id, nombre, apellido, email, role FROM usuarios WHERE id = ?',
            [userId]
        );

        if (rows.length === 0) throw new NotFoundError('Usuario no encontrado');

        logger.info({ userId, role }, 'Rol de usuario actualizado');

        res.json({
            success: true,
            message: 'Rol actualizado correctamente. Hacé refresh del token para obtener el nuevo rol en el JWT.',
            user: {
                id: rows[0].id,
                nombre: rows[0].nombre,
                apellido: rows[0].apellido,
                email: rows[0].email,
                role: rows[0].role,
            },
        });
    } catch (error) {
        next(error);
    }
}

export const __testables = {
    normalizeNullableDate,
    buildUpdateSectionData,
};
