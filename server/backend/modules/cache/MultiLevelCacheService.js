import { createCache } from '../../utils/chatHelpers.js';

const GREETING_PATTERNS = [
    {
        pattern: /^(hola|holi|hey|buenas|buenos dias|buenos días|buenas tardes|buenas noches)[!.?\s]*$/i,
        build: (name) => `¡Hola! Soy el avatar de ${name}. Estoy listo para responder tus preguntas sobre mi perfil profesional.`,
    },
    {
        pattern: /^(gracias|muchas gracias|genial|perfecto|ok)[!.?\s]*$/i,
        build: () => '¡Con gusto! Podés seguir preguntándome sobre mi experiencia, habilidades o proyectos.',
    },
];

export class MultiLevelCacheService {
    constructor() {
        this.l2Semantic = createCache(10 * 60 * 1000, 1000);
        this.l3Response = createCache(10 * 60 * 1000, 1500);
    }

    getGreeting(question, candidateName) {
        const trimmed = (question || '').trim();
        const hit = GREETING_PATTERNS.find(({ pattern }) => pattern.test(trimmed));
        if (!hit) return null;
        return hit.build(candidateName);
    }

    buildKey(candidateId, question) {
        return `candidate:${candidateId}:${question.trim().toLowerCase()}`;
    }

    getSemantic(key) {
        return this.l2Semantic.get(key);
    }

    setSemantic(key, payload) {
        this.l2Semantic.set(key, payload);
    }

    getResponse(key) {
        return this.l3Response.get(key);
    }

    setResponse(key, payload) {
        this.l3Response.set(key, payload);
    }
}
