import { pool } from '../../config/db.js';

function compact(value) {
    if (Array.isArray(value)) {
        const out = value
            .map(compact)
            .filter((v) => v !== null && v !== '' && (!(Array.isArray(v)) || v.length > 0));
        return out.length > 0 ? out : null;
    }

    if (value && typeof value === 'object') {
        const out = Object.entries(value)
            .map(([k, v]) => [k, compact(v)])
            .filter(([, v]) => v !== null && v !== '');
        return out.length > 0 ? Object.fromEntries(out) : null;
    }

    return value === undefined ? null : value;
}

function buildCompiledContext(profile) {
    const user = profile?.usuario || {};
    const sections = [];

    if (user.puesto_actual || user.resumen || user.objetivo_profesional) {
        sections.push(`Resumen profesional: ${user.puesto_actual || ''}. ${user.resumen || ''}. ${user.objetivo_profesional || ''}`.trim());
    }

    if (profile?.experiencia_laboral?.length) {
        const exp = profile.experiencia_laboral.slice(-4).map((e) => `${e.puesto} en ${e.empresa}: ${e.descripcion || ''}`);
        sections.push(`Experiencia: ${exp.join(' | ')}`);
    }

    if (profile?.proyectos?.length) {
        const proy = profile.proyectos.slice(-4).map((p) => `${p.nombre}: ${p.descripcion || ''}`);
        sections.push(`Proyectos: ${proy.join(' | ')}`);
    }

    if (profile?.habilidades?.length) {
        sections.push(`Habilidades: ${profile.habilidades.map((h) => h.nombre).join(', ')}`);
    }

    if (profile?.idiomas?.length) {
        sections.push(`Idiomas: ${profile.idiomas.map((i) => `${i.idioma} (${i.nivel || 'N/A'})`).join(', ')}`);
    }

    return sections.join('\n');
}

export class CandidateContextSnapshotService {
    async upsertSnapshot(userId, profile) {
        const snapshot = compact(profile) || {};
        const compiledContext = buildCompiledContext(profile);

        await pool.query(
            `
                INSERT INTO candidate_context_snapshot (user_id, snapshot_json, compiled_context)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    snapshot_json = VALUES(snapshot_json),
                    compiled_context = VALUES(compiled_context),
                    updated_at = CURRENT_TIMESTAMP
            `,
            [userId, JSON.stringify(snapshot), compiledContext],
        );

        return { snapshot, compiledContext };
    }
}
