import { generateJSON } from './ollamaService.js';
import { buildRecruiterCollectPrompt, buildRecruiterRankPrompt } from '../prompts/recruiter.prompt.js';
import { OLLAMA_MODEL, OLLAMA_TIMEOUT } from '../config/ollama.js';
import logger from '../utils/logger.js';

const COLLECT_FALLBACK = {
    complete: false,
    question: '¿Qué puesto o tarea necesitas cubrir?',
    jobProfile: {},
};
const RANK_FALLBACK = [];

function uniqueList(items = []) {
    return [...new Set((items || []).map(item => String(item || '').trim()).filter(Boolean))];
}

function mergeJobProfile(base = {}, extra = {}) {
    return {
        role: extra.role || base.role || '',
        seniority: extra.seniority || base.seniority || 'no especificado',
        must_have: uniqueList([...(base.must_have || []), ...(extra.must_have || [])]),
        nice_to_have: uniqueList([...(base.nice_to_have || []), ...(extra.nice_to_have || [])]),
        keywords: uniqueList([...(base.keywords || []), ...(extra.keywords || [])]),
    };
}

function inferJobProfileFromText(text = '', currentProfile = {}) {
    const normalized = String(text || '').toLowerCase();
    const inferred = {
        role: currentProfile.role || '',
        seniority: currentProfile.seniority || '',
        must_have: [],
        nice_to_have: [],
        keywords: [],
    };

    if (/(ventas?|vendedor|vendedora|comercio|mostrador|atenci[oó]n al cliente|cajer)/i.test(normalized)) {
        inferred.role ||= 'ventas / atención comercial';
        inferred.must_have.push('ventas', 'atención al cliente');
        inferred.keywords.push('comercio', 'ventas');
    }

    if (/(repositor|reposici[oó]n|dep[oó]sito|stock)/i.test(normalized)) {
        inferred.role ||= 'reposición / logística básica';
        inferred.must_have.push('orden', 'reposici\u00f3n');
        inferred.keywords.push('stock', 'logística');
    }

    if (/(administrativ|secretari|recepci[oó]n)/i.test(normalized)) {
        inferred.role ||= 'administración / recepción';
        inferred.must_have.push('organización', 'trato con personas');
        inferred.keywords.push('administración');
    }

    if (/(backend|node|node\.js|express|\bapi\b|\bapis\b|api rest|sql)/i.test(normalized)) {
        inferred.role ||= 'backend developer';
        inferred.must_have.push('nodejs', 'api rest');
        inferred.keywords.push('backend');
    }

    if (/(frontend|react|javascript|html|css|\bux\b|\bui\b)/i.test(normalized)) {
        inferred.role ||= 'frontend developer';
        inferred.must_have.push('react', 'javascript');
        inferred.keywords.push('frontend');
    }

    if (/(sin experiencia|poca experiencia|junior|\bjr\b|que aprenda|ganas de aprender|reci[eé]n empieza|tarea sencilla|no necesito.*mucha experiencia|joven con poca experiencia)/i.test(normalized)) {
        inferred.seniority = 'junior';
    } else if (/(semi.?senior|ssr)/i.test(normalized)) {
        inferred.seniority = 'semi-senior';
    } else if (/(senior|\bsr\b|mucha experiencia|liderazgo|encargado|autonom[ií]a)/i.test(normalized)) {
        inferred.seniority = 'senior';
    }

    if (/(mañana|inmediata|inmediato|urgente|ya mismo|lo antes posible)/i.test(normalized)) {
        inferred.must_have.push('disponibilidad inmediata');
        inferred.keywords.push('incorporación inmediata');
    }

    if (/(ganas de trabajar|buena actitud|predisposici[oó]n|responsable|puntual)/i.test(normalized)) {
        inferred.must_have.push('buena actitud');
        inferred.keywords.push('responsabilidad');
    }

    if (/(aprend|proactivo|proactiva)/i.test(normalized)) {
        inferred.nice_to_have.push('ganas de aprender');
    }

    return inferred;
}

function isRepeatedQuestion(question = '', conversationHistory = []) {
    const normalizedQuestion = question.toLowerCase().replace(/\s+/g, ' ').trim();
    return conversationHistory
        .filter(m => m.role === 'assistant')
        .some(m => String(m.content || '').toLowerCase().replace(/\s+/g, ' ').trim() === normalizedQuestion);
}

function buildFriendlyFollowup(jobProfile = {}, recruiterText = '') {
    if (!jobProfile.role) {
        return '¿Qué tarea o puesto necesitas cubrir?';
    }

    if ((jobProfile.must_have || []).length === 0) {
        if (/ventas|comercio|atenci[oó]n/i.test(jobProfile.role)) {
            return '¿Lo más importante es vender, atender clientes o cobrar en caja?';
        }
        return '¿Qué es lo más importante que debería saber o hacer esa persona?';
    }

    if (!jobProfile.seniority || jobProfile.seniority === 'no especificado') {
        return '¿Te sirve alguien que recién empieza o prefieres a alguien con experiencia?';
    }

    if (/mañana|urgente|inmediata|inmediato/i.test(recruiterText)) {
        return '¿La incorporación tiene que ser inmediata o puede esperar unos días?';
    }

    return '¿Hay algún detalle más que quieras priorizar para filtrar mejor?';
}

function shouldAutoComplete(jobProfile = {}, conversationHistory = [], recruiterText = '') {
    const userTurns = conversationHistory.filter(m => m.role === 'user').length;
    const hasRole = Boolean(jobProfile.role);
    const hasRequirements = (jobProfile.must_have || []).length > 0 || (jobProfile.keywords || []).length > 0;
    const simpleOperationalSearch = /(ventas|comercio|atenci[oó]n|cajer|reposici[oó]n|administraci[oó]n|mañana|urgente|sin experiencia|ganas de trabajar|ganas de aprender)/i.test(recruiterText);

    return hasRole && (hasRequirements || userTurns >= 2 || simpleOperationalSearch);
}

/**
 * Fase 1: Conversación para recopilar el job profile.
 * Retorna: { complete: bool, question: string|null, jobProfile: object }
 */
export async function collectJobProfile(message, conversationHistory = [], currentProfile = {}) {
    const recruiterText = [
        ...conversationHistory.filter(m => m.role === 'user').map(m => m.content),
        message,
    ].join(' ');

    const inferredProfile = inferJobProfileFromText(recruiterText, currentProfile);
    const prefilledProfile = mergeJobProfile(currentProfile, inferredProfile);

    // Fast-path heurístico: si ya se entiende suficiente el perfil, no llamar al LLM.
    if (shouldAutoComplete(prefilledProfile, conversationHistory, recruiterText)) {
        if (!prefilledProfile.seniority || prefilledProfile.seniority === 'no especificado') {
            if (/sin experiencia|poca experiencia|junior|\bjr\b|ganas de aprender|que aprenda/i.test(recruiterText)) {
                prefilledProfile.seniority = 'junior';
            }
        }

        return {
            complete: true,
            question: null,
            jobProfile: prefilledProfile,
        };
    }

    const prompt = buildRecruiterCollectPrompt(message, conversationHistory, prefilledProfile);

    let result;
    try {
        result = await generateJSON(prompt, COLLECT_FALLBACK, {
            model: OLLAMA_MODEL,
            temperature: 0.1,
            numPredict: 220,
            numCtx: 2048,
            timeout: Math.min(OLLAMA_TIMEOUT, 45000),
        });
    } catch (error) {
        logger.warn({ err: error }, 'Recruiter collect: fallo LLM, usando heurística local');
        return {
            complete: false,
            question: buildFriendlyFollowup(prefilledProfile, recruiterText),
            jobProfile: prefilledProfile,
        };
    }

    if (typeof result?.complete !== 'boolean') {
        logger.warn({ result }, 'Recruiter collect: respuesta inválida, usando fallback');
        return {
            complete: false,
            question: buildFriendlyFollowup(prefilledProfile, recruiterText),
            jobProfile: prefilledProfile,
        };
    }

    const mergedProfile = mergeJobProfile(prefilledProfile, result.jobProfile || {});
    let question = result.question || buildFriendlyFollowup(mergedProfile, recruiterText);
    let complete = Boolean(result.complete);

    if (/seniority/i.test(question) || isRepeatedQuestion(question, conversationHistory)) {
        question = buildFriendlyFollowup(mergedProfile, recruiterText);
    }

    if (shouldAutoComplete(mergedProfile, conversationHistory, recruiterText)) {
        complete = true;
    }

    if (complete && !mergedProfile.role) {
        complete = false;
        question = '¿Qué tarea o puesto necesitas cubrir?';
    }

    if (complete && (!mergedProfile.seniority || mergedProfile.seniority === 'no especificado')) {
        if (/sin experiencia|poca experiencia|junior|\bjr\b|ganas de aprender|que aprenda/i.test(recruiterText)) {
            mergedProfile.seniority = 'junior';
        }
    }

    return {
        complete,
        question: complete ? null : question,
        jobProfile: mergedProfile,
    };
}

/**
 * Fase 3: Rankear candidatos contra el job profile.
 * Retorna: [{ id, score, reason }] ordenado desc por score
 */
export async function rankCandidates(jobProfile, candidateProfiles) {
    if (!candidateProfiles || candidateProfiles.length === 0) return [];

    const prompt = buildRecruiterRankPrompt(jobProfile, candidateProfiles);

    const result = await generateJSON(prompt, RANK_FALLBACK, {
        model: OLLAMA_MODEL,
        temperature: 0,
        numPredict: 400,
        numCtx: 3072,
        timeout: Math.min(OLLAMA_TIMEOUT, 60000),
    });

    if (!Array.isArray(result)) {
        logger.warn({ result }, 'Recruiter rank: respuesta no es array, usando scores por defecto');
        return candidateProfiles.map(c => ({ id: c.id, score: 0.5, reason: 'Evaluación no disponible' }));
    }

    return result.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Convierte un job profile a texto plano para generar el embedding de búsqueda.
 */
export function buildQueryText(jobProfile) {
    const parts = [];
    if (jobProfile.role) parts.push(jobProfile.role);
    if (jobProfile.seniority && jobProfile.seniority !== 'no especificado') parts.push(jobProfile.seniority);
    if (Array.isArray(jobProfile.must_have)) parts.push(...jobProfile.must_have);
    if (Array.isArray(jobProfile.nice_to_have)) parts.push(...jobProfile.nice_to_have);
    if (Array.isArray(jobProfile.keywords)) parts.push(...jobProfile.keywords);
    return uniqueList(parts).join(' ') || 'búsqueda laboral general';
}
