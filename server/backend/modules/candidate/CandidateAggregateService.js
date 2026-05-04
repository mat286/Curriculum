import { pool } from '../../config/db.js';
import { NotFoundError } from '../../middlewares/errorHandler.js';

function parseMaybeJson(value, fallback) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export class CandidateAggregateService {
    async getPublicCandidateAggregate(candidateId) {
        const sql = `
            SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.email,
                u.telefono,
                u.nacionalidad,
                u.direccion,
                u.resumen,
                u.puesto_actual,
                u.objetivo_profesional,
                u.disponibilidad,
                u.modalidad_preferida,
                u.pretension_salarial,
                u.linkedin_url,
                u.github_url,
                u.portfolio_url,
                u.is_public,
                sm.descripcion AS sobre_mi_descripcion,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', e.id,
                        'empresa', e.empresa,
                        'puesto', e.puesto,
                        'descripcion', e.descripcion,
                        'fecha_inicio', e.fecha_inicio,
                        'fecha_fin', e.fecha_fin,
                        'actualmente', e.actualmente
                    ))
                    FROM experiencia_laboral e
                    WHERE e.user_id = u.id
                ), JSON_ARRAY()) AS experiencia_laboral,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', ed.id,
                        'institucion', ed.institucion,
                        'titulo', ed.titulo,
                        'nivel', ed.nivel,
                        'fecha_inicio', ed.fecha_inicio,
                        'fecha_fin', ed.fecha_fin
                    ))
                    FROM educacion ed
                    WHERE ed.user_id = u.id
                ), JSON_ARRAY()) AS educacion,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', c.id,
                        'nombre', c.nombre,
                        'institucion', c.institucion,
                        'descripcion', c.descripcion,
                        'fecha_inicio', c.fecha_inicio,
                        'fecha_fin', c.fecha_fin,
                        'certificado_url', c.certificado_url
                    ))
                    FROM cursos c
                    WHERE c.user_id = u.id
                ), JSON_ARRAY()) AS cursos,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', p.id,
                        'nombre', p.nombre,
                        'descripcion', p.descripcion,
                        'tecnologias', p.tecnologias,
                        'url', p.url,
                        'fecha_inicio', p.fecha_inicio,
                        'fecha_fin', p.fecha_fin
                    ))
                    FROM proyectos p
                    WHERE p.user_id = u.id
                ), JSON_ARRAY()) AS proyectos,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', h.id,
                        'nombre', h.nombre,
                        'categoria', h.categoria,
                        'nivel', h.nivel
                    ))
                    FROM habilidades h
                    WHERE h.user_id = u.id
                ), JSON_ARRAY()) AS habilidades,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', i.id,
                        'idioma', i.idioma,
                        'nivel', i.nivel
                    ))
                    FROM idiomas i
                    WHERE i.user_id = u.id
                ), JSON_ARRAY()) AS idiomas,
                COALESCE((
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'id', r.id,
                        'pregunta', r.pregunta,
                        'respuesta', r.respuesta
                    ))
                    FROM respuestas_entrevista r
                    WHERE r.user_id = u.id
                ), JSON_ARRAY()) AS respuestas_entrevista,
                snap.snapshot_json,
                snap.compiled_context,
                snap.updated_at AS snapshot_updated_at
            FROM usuarios u
            LEFT JOIN sobre_mi sm ON sm.user_id = u.id
            LEFT JOIN candidate_context_snapshot snap ON snap.user_id = u.id
            WHERE u.id = ? AND u.is_public = 1
            LIMIT 1
        `;

        const [rows] = await pool.query(sql, [candidateId]);
        if (rows.length === 0) {
            throw new NotFoundError('Candidato no encontrado o no disponible');
        }

        const row = rows[0];
        const candidateName = `${row.nombre || ''} ${row.apellido || ''}`.trim();

        const profile = {
            usuario: {
                id: row.id,
                nombre: row.nombre,
                apellido: row.apellido,
                email: row.email,
                telefono: row.telefono,
                nacionalidad: row.nacionalidad,
                direccion: row.direccion,
                resumen: row.resumen,
                puesto_actual: row.puesto_actual,
                objetivo_profesional: row.objetivo_profesional,
                disponibilidad: row.disponibilidad,
                modalidad_preferida: row.modalidad_preferida,
                pretension_salarial: row.pretension_salarial,
                linkedin_url: row.linkedin_url,
                github_url: row.github_url,
                portfolio_url: row.portfolio_url,
                is_public: row.is_public,
            },
            sobre_mi: row.sobre_mi_descripcion ? [{ descripcion: row.sobre_mi_descripcion }] : [],
            experiencia_laboral: parseMaybeJson(row.experiencia_laboral, []),
            educacion: parseMaybeJson(row.educacion, []),
            cursos: parseMaybeJson(row.cursos, []),
            proyectos: parseMaybeJson(row.proyectos, []),
            habilidades: parseMaybeJson(row.habilidades, []),
            idiomas: parseMaybeJson(row.idiomas, []),
            respuestas_entrevista: parseMaybeJson(row.respuestas_entrevista, []),
        };

        return {
            candidateId: row.id,
            candidateName,
            profile,
            snapshot: {
                json: parseMaybeJson(row.snapshot_json, null),
                context: row.compiled_context || '',
                updatedAt: row.snapshot_updated_at || null,
            },
        };
    }
}
