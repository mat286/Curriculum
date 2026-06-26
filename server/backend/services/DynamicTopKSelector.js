import logger from '../utils/logger.js';

/**
 * DynamicTopKSelector — selecciona top-k para búsqueda semántica.
 *
 * Simplificado en refactor 2026-06:
 * - Eliminadas señales muertas: semanticSimilarities (siempre []) e historicalHitRate (siempre null)
 * - Las señales activas son: intentConfidence (85%) + questionLength (15%)
 * - Comportamiento idéntico al original para los casos reales
 */
export class DynamicTopKSelector {
    constructor() {
        this.minTopK    = parseInt(process.env.SEMANTIC_TOPK_MIN     || '2', 10);
        this.maxTopK    = parseInt(process.env.SEMANTIC_TOPK_MAX     || '5', 10);
        this.defaultTopK = parseInt(process.env.SEMANTIC_TOPK_DEFAULT || '3', 10);
        this.disableBelowConfidence = parseFloat(process.env.DISABLE_RAG_BELOW_CONFIDENCE || '0.3');

        // Permite ajustar topK por intent via JSON env var
        this.intentBonus = this._parseIntentBonus(process.env.SEMANTIC_TOPK_INTENT_BONUS);
    }

    _parseIntentBonus(raw) {
        if (!raw) return { contact: -1, social: -1, availability: -1, faq_candidate: -1, technologies: 1, projects: 1 };
        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch { return {}; }
    }

    selectTopK({ intentConfidence, questionLength = 0, intent, candidateId, requestId }) {
        const intentSignal = intentConfidence || 0.5;

        // Heurística de longitud: preguntas muy cortas o muy largas = menos confianza
        const wordEstimate = questionLength / 5;
        const lengthSignal = (wordEstimate < 3 || wordEstimate > 50) ? 0.4 : 0.7;

        const confidence = Math.max(0, Math.min(1, intentSignal * 0.85 + lengthSignal * 0.15));

        let topK = this.defaultTopK;
        let decision = 'default';

        if      (confidence >= 0.9) { topK = 2; decision = 'minimal-retrieval';  }
        else if (confidence >= 0.7) { topK = 3; decision = 'balanced-retrieval'; }
        else if (confidence >= 0.5) { topK = 4; decision = 'expanded-retrieval'; }
        else if (confidence <  this.disableBelowConfidence) { topK = -1; decision = 'disable-rag'; }
        else                        { topK = 5; decision = 'maximum-retrieval';  }

        if (topK !== -1) {
            topK += Number(this.intentBonus[intent] || 0);
            if (wordEstimate >= 25) topK += 1;
            topK = Math.max(this.minTopK, Math.min(topK, this.maxTopK));
        }

        const result = { topK, confidenceScore: parseFloat(confidence.toFixed(3)), decision, intent };
        logger.debug(result, 'DynamicTopKSelector decision');
        return result;
    }

    getEffectiveTopK(selectedTopK) {
        const override = parseInt(process.env.SEMANTIC_TOPK_OVERRIDE || '', 10);
        if (Number.isFinite(override) && override > 0) {
            logger.warn({ override, selected: selectedTopK }, 'TopK override via ENV');
            return override;
        }
        return selectedTopK;
    }
}
