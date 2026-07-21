const INTENT_SECTION_MAP = {
    work_experience: ['experiencia_laboral', 'sobre_mi'],
    education: ['educacion'],
    skills: ['habilidades', 'proyectos'],
    projects: ['proyectos', 'habilidades'],
    technologies: ['habilidades', 'proyectos', 'experiencia_laboral'],
    languages: ['idiomas'],
    contact: ['usuario'],
    social: ['usuario'],
    availability: ['usuario'],
    summary: ['sobre_mi', 'usuario', 'experiencia_laboral'],
    personal: ['usuario'],
    faq_candidate: ['respuestas_entrevista'],
    general: ['sobre_mi', 'experiencia_laboral', 'habilidades', 'proyectos', 'educacion', 'idiomas', 'usuario'],
};

const INTENT_QUERY_TYPE_MAP = {
    work_experience: 'detail',
    education: 'detail',
    skills: 'detail',
    projects: 'detail',
    technologies: 'detail',
    languages: 'fact',
    contact: 'fact',
    social: 'fact',
    availability: 'fact',
    summary: 'general',
    personal: 'fact',
    faq_candidate: 'fact',
    general: 'general',
};

function unique(values) {
    return [...new Set(values)];
}

export class ContextSelectorService {
    select(intent, confidence = 0.6, question = '') {
        const resolvedIntent = intent || 'general';
        const include = INTENT_SECTION_MAP[resolvedIntent] || INTENT_SECTION_MAP.general;

        let finalInclude = include.slice();
        if (confidence < 0.7 && resolvedIntent !== 'general') {
            finalInclude = unique([...finalInclude, 'sobre_mi']);
        }

        // Para preguntas muy precisas y alta confianza reducimos ruido contextual,
        // pero nunca por debajo del set base mapeado para el intent (evita perder
        // secciones legítimas, ej. 'technologies' mapea a 3 secciones).
        const looksSpecific = String(question || '').trim().split(/\s+/).length <= 8;
        if (confidence >= 0.9 && resolvedIntent !== 'general' && looksSpecific) {
            finalInclude = finalInclude.slice(0, Math.max(include.length, 2));
        }

        const queryType = INTENT_QUERY_TYPE_MAP[resolvedIntent] || 'general';
        const minSimilarityBoost =
            queryType === 'fact' ? 0.06 : queryType === 'detail' ? 0.03 : 0;

        return {
            include: finalInclude,
            retrievalPolicy: {
                queryType,
                minSimilarityBoost,
                sectionPriority: finalInclude.slice(),
            },
        };
    }

    pickFromProfile(profile, includeSections) {
        const output = {};
        for (const section of includeSections) {
            if (profile?.[section] !== undefined) {
                output[section] = profile[section];
            }
        }

        if (!output.usuario && profile?.usuario) {
            output.usuario = {
                nombre: profile.usuario.nombre,
                apellido: profile.usuario.apellido,
                puesto_actual: profile.usuario.puesto_actual,
                resumen: profile.usuario.resumen,
                disponibilidad: profile.usuario.disponibilidad,
                modalidad_preferida: profile.usuario.modalidad_preferida,
                pretension_salarial: profile.usuario.pretension_salarial,
                linkedin_url: profile.usuario.linkedin_url,
                github_url: profile.usuario.github_url,
                portfolio_url: profile.usuario.portfolio_url,
                email: profile.usuario.email,
                telefono: profile.usuario.telefono,
            };
        }

        return output;
    }
}
