import logger from '../utils/logger.js';

/**
 * DynamicTopKSelector
 * 
 * Selecciona dinámicamente el top-k para búsqueda semántica basado en:
 * - Relevance confidence del intent classifier
 * - Semantic similarity scores
 * - Heurísticas de fallback
 * 
 * Objetivo: Mejorar recall cuando hay baja confianza, mantener eficiencia cuando hay alta confianza.
 * 
 * Estrategia:
 * - confidence >= 90%: top-k=2 (pregunta clara, recuperación minimalista)
 * - confidence 70-90%: top-k=3 (pregunta moderada)
 * - confidence 50-70%: top-k=4 (pregunta ambigua)
 * - confidence < 50%: top-k=5 o disable RAG (muy bajo confidence)
 */
export class DynamicTopKSelector {
    constructor() {
        this.minTopK = parseInt(process.env.SEMANTIC_TOPK_MIN || '2', 10);
        this.maxTopK = parseInt(process.env.SEMANTIC_TOPK_MAX || '5', 10);
        this.defaultTopK = parseInt(process.env.SEMANTIC_TOPK_DEFAULT || '3', 10);
        this.disableBelowConfidence = parseFloat(process.env.DISABLE_RAG_BELOW_CONFIDENCE || '0.3');
        this.thresholds = {
            high: 0.9,
            medium: 0.7,
            low: 0.5,
        };
    }

    /**
     * Evalúa confidence_score basado en múltiples señales:
     * - intent confidence del classifier
     * - semantic similarity promedio de embeddings previos
     * - question length heuristic
     * - historical hit rate si existe
     */
    evaluateConfidence({
        intentConfidence,
        semanticSimilarities = [],
        questionLength,
        historicalHitRate = null,
    }) {
        let confidenceScore = intentConfidence || 0.5;

        // Señal 1: Intent confidence (peso 60%)
        const intentSignal = intentConfidence || 0.5;

        // Señal 2: Semantic similarity (peso 25%)
        let semanticSignal = 0.5;
        if (semanticSimilarities.length > 0) {
            const avgSimilarity = semanticSimilarities.reduce((a, b) => a + b, 0) / semanticSimilarities.length;
            semanticSignal = Math.max(0, Math.min(1, avgSimilarity));
        }

        // Señal 3: Question length heuristic (peso 10%)
        // Preguntas muy cortas (<3 palabras) o muy largas (>50 palabras) tienen menos confianza
        const wordCount = (questionLength || 0) / 5; // estimación: 5 chars por palabra
        let lengthSignal = 0.5;
        if (wordCount < 3) {
            lengthSignal = 0.4; // pregunta muy corta
        } else if (wordCount > 50) {
            lengthSignal = 0.4; // pregunta muy compleja
        } else {
            lengthSignal = 0.7; // rango normal
        }

        // Señal 4: Historical hit rate (peso 5%)
        let historicalSignal = 0.5;
        if (typeof historicalHitRate === 'number' && historicalHitRate >= 0) {
            historicalSignal = historicalHitRate;
        }

        // Combinar señales con pesos
        confidenceScore =
            intentSignal * 0.6 + semanticSignal * 0.25 + lengthSignal * 0.1 + historicalSignal * 0.05;

        // Clamp a [0, 1]
        confidenceScore = Math.max(0, Math.min(1, confidenceScore));

        return {
            confidenceScore: parseFloat(confidenceScore.toFixed(3)),
            intentSignal: parseFloat(intentSignal.toFixed(3)),
            semanticSignal: parseFloat(semanticSignal.toFixed(3)),
            lengthSignal: parseFloat(lengthSignal.toFixed(3)),
            historicalSignal: parseFloat(historicalSignal.toFixed(3)),
        };
    }

    /**
     * Selecciona top-k basado en confidence score.
     * Retorna { topK, confidenceScore, decision, rationale }
     */
    selectTopK({
        intentConfidence,
        semanticSimilarities = [],
        questionLength,
        intent,
        candidateId,
        requestId,
    }) {
        const confidenceData = this.evaluateConfidence({
            intentConfidence,
            semanticSimilarities,
            questionLength,
        });

        const { confidenceScore } = confidenceData;

        let topK = this.defaultTopK;
        let decision = 'default';
        let rationale = '';

        // Decisión basada en confidence
        if (confidenceScore >= this.thresholds.high) {
            topK = 2; // Fijo: minimal retrieval
            decision = 'minimal-retrieval';
            rationale = 'Alta confianza: pregunta clara y bien definida, recuperación minimalista';
        } else if (confidenceScore >= this.thresholds.medium) {
            topK = 3;
            decision = 'balanced-retrieval';
            rationale = 'Confianza media: pregunta moderadamente clara';
        } else if (confidenceScore >= this.thresholds.low) {
            topK = 4;
            decision = 'expanded-retrieval';
            rationale = 'Baja confianza: pregunta ambigua, expandir retrieval para recall';
        } else {
            // Muy baja confianza: considerar disable RAG o máximo retrieval
            if (confidenceScore < this.disableBelowConfidence) {
                topK = -1; // Señal especial: disable RAG
                decision = 'disable-rag';
                rationale = 'Confianza muy baja: desactivar RAG y usar solo CV general';
            } else {
                topK = 5;
                decision = 'maximum-retrieval';
                rationale = 'Confianza muy baja: máximo retrieval para coverage';
            }
        }

        // Garantizar rango válido (excepto para disable-rag)
        if (topK !== -1) {
            topK = Math.max(this.minTopK, Math.min(topK, this.maxTopK));
        }

        const result = {
            topK,
            confidenceScore,
            decision,
            rationale,
            intent,
            candidateId,
            requestId,
            confidenceBreakdown: confidenceData,
            timestamp: new Date().toISOString(),
        };

        logger.debug(result, 'DynamicTopKSelector decision');

        return result;
    }

    /**
     * Override explícito via env var SEMANTIC_TOPK_OVERRIDE.
     * Útil para testing y debugging.
     */
    getEffectiveTopK(selectedTopK) {
        const override = parseInt(process.env.SEMANTIC_TOPK_OVERRIDE || '', 10);
        if (Number.isFinite(override) && override > 0) {
            logger.warn({ override, selected: selectedTopK }, 'TopK override via ENV');
            return override;
        }
        return selectedTopK;
    }
}
