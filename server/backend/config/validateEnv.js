import logger from '../utils/logger.js';

/**
 * Valida las variables de entorno requeridas según el proveedor de IA activo.
 * Debe llamarse al arranque, antes de iniciar el servidor.
 * Sale con código 1 si hay variables críticas faltantes.
 */
export function validateEnv() {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
    const errors = [];
    const warnings = [];

    // ── Variables siempre requeridas ──────────────────────────────
    if (!process.env.JWT_SECRET) {
        errors.push('JWT_SECRET es requerida');
    } else if (process.env.JWT_SECRET === 'change_me_jwt_secret_at_least_32_chars') {
        warnings.push('JWT_SECRET usa el valor por defecto — cambialo antes de ir a producción');
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
        errors.push('GOOGLE_CLIENT_ID es requerida para el login con Google');
    }
    if (!process.env.DB_HOST) {
        errors.push('DB_HOST es requerida');
    }
    if (!process.env.CHROMA_URL) {
        warnings.push('CHROMA_URL no configurada, se usará http://localhost:8000');
    }

    // ── Variables según el proveedor ─────────────────────────────
    if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) {
            errors.push('GEMINI_API_KEY es requerida cuando AI_PROVIDER=gemini');
        }
    } else if (provider === 'ollama') {
        if (!process.env.OLLAMA_URL) {
            warnings.push('OLLAMA_URL no configurada, se usará http://localhost:11434');
        }
        // Ollama siempre necesita estar corriendo para embeddings también
    } else {
        errors.push(`AI_PROVIDER="${provider}" no válido. Valores aceptados: "gemini" | "ollama"`);
    }

    // ── Embeddings (siempre usan Ollama) ─────────────────────────
    if (!process.env.OLLAMA_URL && provider !== 'ollama') {
        warnings.push('OLLAMA_URL no configurada — los embeddings (búsqueda semántica) pueden fallar');
    }

    // ── Reportar ─────────────────────────────────────────────────
    warnings.forEach(w => logger.warn(`[ENV] ${w}`));

    if (errors.length > 0) {
        errors.forEach(e => logger.error(`[ENV] ❌ ${e}`));
        logger.error('[ENV] El servidor no puede iniciar por variables de entorno faltantes o inválidas.');
        process.exit(1);
    }

    logger.info(`[ENV] ✅ Proveedor IA activo: ${provider.toUpperCase()}`);
}
