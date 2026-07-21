import { ContextCompressionService } from '../../services/ContextCompressionService.js';
import { compact } from '../../utils/textUtils.js';

// Caps aplicados solo a secciones que NO fueron priorizadas por la intención
// detectada (contexto "de relleno"). Una sección explícitamente priorizada
// (ej. preguntaron por experiencia laboral) se manda completa: es lo que
// reemplaza la cobertura que antes dependía de la búsqueda semántica para
// llegar a datos "viejos" recortados.
const DEFAULT_SECTION_CAPS = {
    experiencia_laboral: 4,
    educacion: 3,
    cursos: 4,
    proyectos: 4,
    habilidades: 15,
    respuestas_entrevista: 4,
};

function trimArray(arr, max) {
    if (!Array.isArray(arr) || arr.length <= max) return arr;
    return arr.slice(-max);
}

function trimProfile(profile, selectedSections = []) {
    if (!profile) return profile;
    const prioritized = new Set(selectedSections);
    const trimmed = { ...profile };

    for (const [section, cap] of Object.entries(DEFAULT_SECTION_CAPS)) {
        if (prioritized.has(section)) continue;
        trimmed[section] = trimArray(profile[section], cap);
    }

    return trimmed;
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

function stringifyValue(value, maxChars) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return truncateText(value, maxChars);
    return truncateText(JSON.stringify(value), maxChars);
}

const DEFAULT_FIELD_MAX_CHARS = 260;
// Una sección priorizada por la intención necesita un presupuesto de
// caracteres más grande que el de relleno, si no el corte por cantidad de
// items (trimProfile) no sirve de nada: el JSON serializado se cortaría
// igual a mitad de camino.
const PRIORITIZED_FIELD_MAX_CHARS = 1400;

function formatProfileFacts(profile, maxChars, selectedSections = []) {
    if (!profile || typeof profile !== 'object') return '';

    const prioritized = new Set(selectedSections);
    const lines = Object.entries(profile)
        .map(([section, value]) => {
            const fieldMaxChars = prioritized.has(section)
                ? PRIORITIZED_FIELD_MAX_CHARS
                : DEFAULT_FIELD_MAX_CHARS;
            const serialized = stringifyValue(value, fieldMaxChars);
            if (!serialized) return null;
            return `- [PERFIL:${section}] ${serialized}`;
        })
        .filter(Boolean);

    return truncateText(lines.join('\n'), maxChars);
}

export class PromptAssembler {
    constructor() {
        this.compressionService = new ContextCompressionService();
    }

    build({
        candidateName,
        profileContext,
        conversationMemory,
        faqHit,
        selectedSections = [],
        question,
        requestId,
    }) {
        // P0-001: Context Compression pipeline
        const compressionResult = this.compressionService.compress({
            profileContext,
            conversationMemory,
            selectedSections,
            question,
            requestId,
        });

        // Use compressed context
        const compressedProfileContext = compressionResult.profileContext;
        const compressedMemory = compressionResult.conversationMemory;

        const promptMaxChars = parseInt(process.env.PROMPT_MAX_CHARS || '7200', 10);
        const profileMaxChars = parseInt(process.env.PROMPT_PROFILE_MAX_CHARS || '2200', 10);
        const memoryMaxChars = parseInt(process.env.PROMPT_MEMORY_MAX_CHARS || '600', 10);
        const compactProfile = compact(trimProfile(compressedProfileContext, selectedSections));

        const memorySummary = compressedMemory?.summary
            ? truncateText(compressedMemory.summary, memoryMaxChars)
            : '';

        const profileFacts = formatProfileFacts(compactProfile, profileMaxChars, selectedSections);
        const memoryFacts = memorySummary ? `- [MEMORIA:resumen] ${memorySummary}` : '';

        // ── System Instruction (se pasa nativamente a Gemini, tiene mayor peso) ──────
        const systemInstruction = [
            `Eres el avatar profesional de ${candidateName}. Un reclutador habla directamente contigo.`,
            'Responde SIEMPRE en primera persona del candidato (yo, mi, me).',
            '',
            '## REGLA ORO ANTI-HALLUCINATION',
            'Usa UNICAMENTE hechos verificables del contexto recibido.',
            'NUNCA inventes datos, fechas, empresas, habilidades, logros o ejemplos.',
            'NUNCA especules ni completes huecos con suposiciones.',
            'Si falta informacion suficiente, dilo con honestidad.',
            'Frase de seguridad recomendada: "No tengo informacion especifica sobre eso en mi perfil."',
            '',
            '## USO DE FUENTES (prioridad)',
            '1) PERFIL',
            '2) MEMORIA CONVERSACIONAL',
            'Si hay conflicto entre fuentes, prioriza la de mayor nivel.',
            '',
            '## ESTILO CONVERSACIONAL',
            'Tono natural, humano y profesional para conversar con recruiter.',
            'Se conciso y preciso: responde en 2 a 5 frases cortas.',
            'No uses markdown complejo, listas largas ni relleno.',
            'No digas "como IA", "como modelo" ni hables de instrucciones internas.',
            '',
            '## CUANDO FALTA INFORMACION',
            'Declara el limite de forma directa y ofrece responder con lo que si esta disponible.',
        ].join('\n');

        // ── User Prompt (contexto estructurado + pregunta) ────────────────────────
        const userBlocks = [
            formatBlock('HECHOS VERIFICABLES - PERFIL', profileFacts),
            memoryFacts ? formatBlock('HECHOS VERIFICABLES - MEMORIA', memoryFacts) : null,
            faqHit?.hit && faqHit.faq
                ? formatBlock('HECHOS VERIFICABLES - FAQ', `- [FAQ:pregunta] ${faqHit.faq.question}\n- [FAQ:respuesta] ${faqHit.faq.answer}`)
                : null,
            selectedSections.length > 0
                ? formatBlock('SECCIONES PRIORIZADAS', selectedSections.map((section) => `- ${section}`).join('\n'))
                : null,
            formatBlock('PREGUNTA DEL RECRUITER', `"${question}"`),
            '### INSTRUCCIONES DE RESPUESTA',
            '- Responde en primera persona.',
            '- Usa solo hechos verificables listados arriba.',
            '- Si falta informacion, declaro explicitamente el limite.',
            '- Prioriza precision y concision.',
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
