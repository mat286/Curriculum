/**
 * Factory de proveedores de IA (Strategy Pattern).
 *
 * Controla qué implementación de IA se usa en toda la aplicación.
 * Cambiá AI_PROVIDER en el .env para alternar:
 *   AI_PROVIDER=gemini   → GeminiProvider  (por defecto)
 *   AI_PROVIDER=ollama   → OllamaProvider
 *
 * NOTA: Los embeddings (búsqueda semántica) SIEMPRE usan Ollama,
 * independientemente de este proveedor. Ver embeddingService.js.
 */
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import logger from '../utils/logger.js';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

let provider;

if (AI_PROVIDER === 'ollama') {
    provider = new OllamaProvider();
    logger.info('Proveedor IA: Ollama (local)');
} else {
    // Por defecto: Gemini
    provider = new GeminiProvider();
    logger.info(`Proveedor IA: Gemini (${process.env.GEMINI_MODEL || 'gemini-2.0-flash'})`);
}

export default provider;
