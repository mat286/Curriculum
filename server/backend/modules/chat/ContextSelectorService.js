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

export class ContextSelectorService {
    select(intent, confidence = 0.6) {
        const include = INTENT_SECTION_MAP[intent] || INTENT_SECTION_MAP.general;
        if (confidence < 0.7 && intent !== 'general') {
            return { include: [...new Set([...include, 'sobre_mi'])] };
        }
        return { include: include.slice() };
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
