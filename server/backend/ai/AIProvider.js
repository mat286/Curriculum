/**
 * Clase base abstracta para proveedores de IA.
 * Todos los proveedores concretos (Gemini, Ollama) deben extender esta clase.
 */
export class AIProvider {
    /**
     * Genera texto a partir de un prompt.
     * @param {string} prompt
     * @param {object} [options]
     * @param {string}  [options.model]       - Modelo específico a usar
     * @param {number}  [options.timeout]     - Timeout en ms
     * @param {number}  [options.temperature] - 0.0–1.0
     * @param {number}  [options.numPredict]  - Tokens máximos de salida
     * @param {number}  [options.numCtx]      - Tamaño del contexto (Ollama)
     * @param {string}  [options.keepAlive]   - Keep-alive (Ollama)
     * @returns {Promise<string>}
     */
    async generate(prompt, options = {}) {
        throw new Error(`${this.constructor.name} debe implementar generate()`);
    }

    /**
     * Genera JSON estructurado a partir de un prompt.
     * Si el modelo no puede devolver JSON válido, retorna el fallback.
     * @param {string} prompt
     * @param {*}      [fallback=null]
     * @param {object} [options]
     * @returns {Promise<object|Array|null>}
     */
    async generateJSON(prompt, fallback = null, options = {}) {
        throw new Error(`${this.constructor.name} debe implementar generateJSON()`);
    }

    /**
     * Precalienta el modelo (carga en memoria).
     * Puede ser un no-op para proveedores en la nube.
     * @param {string} [model]
     * @returns {Promise<void>}
     */
    async warmupModel(model) {
        // No-op por defecto (proveedores cloud no necesitan warmup)
    }
}
