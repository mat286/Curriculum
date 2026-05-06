import { ContextCompressionService } from '../../services/ContextCompressionService.js';

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

function truncateText(value, maxChars) {
    const text = String(value || '');
    if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
}

function formatBlock(title, content) {
    if (!content) return null;
    return `### ${title}\n${content}`;
}

export class PromptAssembler {
    constructor() {
        this.compressionService = new ContextCompressionService();
    }

    build({
        candidateName,
        profileContext,
        semanticContext = [],
        conversationMemory,
        faqHit,
        selectedSections = [],
        question,
        requestId,
    }) {
        // P0-001: Context Compression pipeline
        const compressionResult = this.compressionService.compress({
            profileContext,
            semanticContext,
            conversationMemory,
            selectedSections,
            question,
            requestId,
        });

        // Use compressed context
        const compressedProfileContext = compressionResult.profileContext;
        const compressedSemanticContext = compressionResult.semanticContext;
        const compressedMemory = compressionResult.conversationMemory;

        const promptMaxChars = parseInt(process.env.PROMPT_MAX_CHARS || '7200', 10);
        const profileMaxChars = parseInt(process.env.PROMPT_PROFILE_MAX_CHARS || '2200', 10);
        const semanticMaxChars = parseInt(process.env.PROMPT_SEMANTIC_MAX_CHARS || '1800', 10);
        const memoryMaxChars = parseInt(process.env.PROMPT_MEMORY_MAX_CHARS || '600', 10);
        const compactProfile = compact(trimProfile(compressedProfileContext));

        const memorySummary = compressedMemory?.summary
            ? truncateText(compressedMemory.summary, memoryMaxChars)
            : '';

        const profileJson = compactProfile ? truncateText(JSON.stringify(compactProfile), profileMaxChars) : '';

        const semanticRaw = compressedSemanticContext.length > 0 ? compressedSemanticContext.join(' | ') : '';
        const semanticSummary = truncateText(semanticRaw, semanticMaxChars);

        // ── System Instruction (se pasa nativamente a Gemini, tiene mayor peso) ──────
        const systemInstruction = [
            `Eres el avatar profesional de ${candidateName}. Un reclutador habla directamente contigo.`,
            'Responde SIEMPRE en primera persona, como si el candidato respondiera en persona.',
            '',
            '## REGLA ORO — ANTI-HALLUCINATION',
            'Responde ÚNICAMENTE con información del contexto proporcionado.',
            'NUNCA inventes datos, fechas, empresas, habilidades, logros o ejemplos.',
            'NUNCA especules ni rellenes huecos con información lógica pero no verificada.',
            'Si la información no está en el contexto, responde exactamente:',
            '  "No tengo información específica sobre eso en mi perfil."',
            '',
            '## FUENTES DE INFORMACIÓN (en orden de prioridad)',
            '1. CONTEXTO SEMÁNTICO — fragmentos de búsqueda vectorial, son la fuente más específica',
            '2. PERFIL CV — datos estructurados generales del candidato',
            '3. MEMORIA CONVERSACIONAL — lo dicho en turnos anteriores de esta sesión',
            '',
            '## PROTOCOLO SI FALTA INFORMACIÓN',
            'Di: "No tengo información específica sobre eso." y ofrece redirigir a algo relacionado.',
            'NUNCA digas: "probablemente", "supongo que", "generalmente", "es razonable pensar".',
            '',
            '## FORMATO',
            'Extensión: 3 a 6 líneas. Tono: profesional, directo, confiado pero honesto.',
            'Sin markdown complejo. Sin listas numeradas salvo que sea imprescindible.',
        ].join('\n');

        // ── User Prompt (contexto estructurado + pregunta) ────────────────────────
        const userBlocks = [
            formatBlock('PERFIL DEL CANDIDATO', profileJson),
            memorySummary ? formatBlock('MEMORIA CONVERSACIONAL', memorySummary) : null,
            faqHit?.hit && faqHit.faq
                ? formatBlock('REFERENCIA FRECUENTE', `P: ${faqHit.faq.question} | R: ${faqHit.faq.answer}`)
                : null,
            formatBlock('CONTEXTO SEMÁNTICO', semanticSummary),
            formatBlock('PREGUNTA DEL RECLUTADOR', `"${question}"`),
            '### RESPUESTA (en primera persona, 3 a 6 líneas):',
        ].filter(Boolean);

        const userPrompt = truncateText(userBlocks.join('\n\n'), promptMaxChars);

        return {
            systemInstruction,
            userPrompt,
            // Alias backward-compatible para consumidores legacy
            prompt: userPrompt,
            compressionStats: compressionResult.stats,
        };
    }
}
