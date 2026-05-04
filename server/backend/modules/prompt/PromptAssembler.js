function compact(value) {
    if (Array.isArray(value)) {
        const out = value.map(compact).filter((v) => v !== null && v !== '' && (!(Array.isArray(v)) || v.length > 0));
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

function trimArray(arr, max) {
    if (!Array.isArray(arr) || arr.length <= max) return arr;
    return arr.slice(-max);
}

function trimProfile(profile) {
    if (!profile) return profile;
    return {
        ...profile,
        experiencia_laboral: trimArray(profile.experiencia_laboral, 4),
        educacion: trimArray(profile.educacion, 3),
        cursos: trimArray(profile.cursos, 4),
        proyectos: trimArray(profile.proyectos, 4),
        habilidades: trimArray(profile.habilidades, 15),
        respuestas_entrevista: trimArray(profile.respuestas_entrevista, 4),
    };
}

export class PromptAssembler {
    build({
        candidateName,
        profileContext,
        semanticContext = [],
        conversationMemory,
        faqHit,
        selectedSections = [],
        question,
    }) {
        const compactProfile = compact(trimProfile(profileContext));

        const sections = [
            `Eres ${candidateName}. Un reclutador habla con tu avatar profesional.`,
            'Responde siempre en primera persona, de forma clara y concreta.',
            'No inventes información. Si falta un dato, dilo explícitamente.',
        ];

        if (conversationMemory?.summary) {
            sections.push(`MEMORIA CONVERSACIONAL: ${conversationMemory.summary}`);
        }

        if (selectedSections.length > 0) {
            sections.push(`SECCIONES USADAS: ${selectedSections.join(', ')}`);
        }

        if (faqHit?.hit && faqHit.faq) {
            sections.push(`FAQ RELEVANTE: Q=${faqHit.faq.question} | A=${faqHit.faq.answer}`);
        }

        if (compactProfile) {
            sections.push(`PERFIL DEL CANDIDATO: ${JSON.stringify(compactProfile)}`);
        }

        if (semanticContext.length > 0) {
            sections.push(`CONTEXTO SEMÁNTICO: ${semanticContext.join(' | ')}`);
        }

        sections.push(`PREGUNTA: "${question}"`);
        sections.push('Respuesta en primera persona (3 a 6 líneas):');

        return sections.join('\n\n');
    }
}
