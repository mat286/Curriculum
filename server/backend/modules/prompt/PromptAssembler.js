import { ContextCompressionService } from '../../services/ContextCompressionService.js';
import { normalizeText, tokenize, lexicalOverlapScore, compact } from '../../utils/textUtils.js';

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

function stringifyValue(value, maxChars) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return truncateText(value, maxChars);
    return truncateText(JSON.stringify(value), maxChars);
}

function formatProfileFacts(profile, maxChars) {
    if (!profile || typeof profile !== 'object') return '';

    const lines = Object.entries(profile)
        .map(([section, value]) => {
            const serialized = stringifyValue(value, 260);
            if (!serialized) return null;
            return `- [PERFIL:${section}] ${serialized}`;
        })
        .filter(Boolean);

    return truncateText(lines.join('\n'), maxChars);
}

function dedupeSemanticChunks(chunks) {
    const seen = new Set();
    const deduped = [];

    for (const chunk of chunks) {
        const key = normalizeText(chunk).slice(0, 160);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(chunk);
    }

    return deduped;
}

function prioritizeSemanticChunks({ chunks, question, selectedSections = [], maxChunks }) {
    const deduped = dedupeSemanticChunks(chunks || []);
    const sectionTokens = new Set(tokenize(selectedSections.join(' ')));

    const ranked = deduped.map((chunk, index) => {
        const overlap = lexicalOverlapScore(chunk, question);
        const hasSectionHint = tokenize(chunk).some((t) => sectionTokens.has(t));
        const score = overlap + (hasSectionHint ? 0.05 : 0) - index * 0.01;
        return { chunk, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, maxChunks).map((item) => item.chunk);
}

function formatSemanticFacts(chunks, maxChars, question, selectedSections, maxChunks, chunkMaxChars) {
    if (!Array.isArray(chunks) || chunks.length === 0) return '';

    const prioritized = prioritizeSemanticChunks({
        chunks,
        question,
        selectedSections,
        maxChunks,
    });

    const lines = prioritized
        .map((chunk, index) => {
            const text = stringifyValue(chunk, chunkMaxChars);
            if (!text) return null;
            return `- [SEMANTICO:${index + 1}] ${text}`;
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
        const semanticMaxChunks = parseInt(process.env.PROMPT_SEMANTIC_MAX_CHUNKS || '5', 10);
        const semanticChunkMaxChars = parseInt(process.env.PROMPT_SEMANTIC_CHUNK_MAX_CHARS || '280', 10);
        const memoryMaxChars = parseInt(process.env.PROMPT_MEMORY_MAX_CHARS || '600', 10);
        const compactProfile = compact(trimProfile(compressedProfileContext));

        const memorySummary = compressedMemory?.summary
            ? truncateText(compressedMemory.summary, memoryMaxChars)
            : '';

        const profileFacts = formatProfileFacts(compactProfile, profileMaxChars);
        const semanticFacts = formatSemanticFacts(
            compressedSemanticContext,
            semanticMaxChars,
            question,
            selectedSections,
            Number.isFinite(semanticMaxChunks) && semanticMaxChunks > 0 ? semanticMaxChunks : 5,
            Number.isFinite(semanticChunkMaxChars) && semanticChunkMaxChars > 0
                ? semanticChunkMaxChars
                : 280,
        );
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
            '1) CONTEXTO SEMANTICO',
            '2) PERFIL',
            '3) MEMORIA CONVERSACIONAL',
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
            formatBlock('HECHOS VERIFICABLES - CONTEXTO SEMANTICO', semanticFacts),
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
