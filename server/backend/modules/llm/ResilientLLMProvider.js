import logger from '../../utils/logger.js';

export class ResilientLLMProvider {
    constructor(provider, options = {}) {
        this.provider = provider;
        this.maxRetries = options.maxRetries ?? 1;
        this.circuitThreshold = options.circuitThreshold ?? 4;
        this.circuitCooldownMs = options.circuitCooldownMs ?? 30000;
        this.failures = 0;
        this.openUntil = 0;
    }

    isCircuitOpen() {
        return Date.now() < this.openUntil;
    }

    markFailure(err) {
        this.failures += 1;
        if (this.failures >= this.circuitThreshold) {
            this.openUntil = Date.now() + this.circuitCooldownMs;
            logger.warn({ failures: this.failures }, 'LLM circuit breaker abierto temporalmente');
        }
        return err;
    }

    markSuccess() {
        this.failures = 0;
        this.openUntil = 0;
    }

    async generate(prompt, options = {}) {
        if (this.isCircuitOpen()) {
            throw new Error('LLM temporalmente no disponible (circuit breaker)');
        }

        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const out = await this.provider.generate(prompt, options);
                this.markSuccess();
                return out;
            } catch (error) {
                lastError = error;
                if (attempt === this.maxRetries) break;
            }
        }

        throw this.markFailure(lastError);
    }

    async generateStream(prompt, options = {}, onChunk) {
        if (this.isCircuitOpen()) {
            throw new Error('LLM temporalmente no disponible (circuit breaker)');
        }

        try {
            const out = await this.provider.generateStream(prompt, options, onChunk);
            this.markSuccess();
            return out;
        } catch (error) {
            throw this.markFailure(error);
        }
    }
}
