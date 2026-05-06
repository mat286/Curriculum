import { generate, generateStream } from './ollamaService.js';
import { OLLAMA_KEEP_ALIVE, OLLAMA_MODEL, OLLAMA_NUM_CTX, OLLAMA_TIMEOUT } from '../config/ollama.js';

// Opciones base para Ollama (usado como fallback cuando Gemini no está disponible)
const RESPONSE_OPTIONS = {
    model: OLLAMA_MODEL,
    keepAlive: OLLAMA_KEEP_ALIVE,
    temperature: 0.25,
    numPredict: 300,
    numCtx: Math.min(OLLAMA_NUM_CTX, 2048),
    timeout: OLLAMA_TIMEOUT,
};

const STREAM_OPTIONS = {
    ...RESPONSE_OPTIONS,
    numPredict: 220,
};

/**
 * Genera respuesta a partir de un prompt ya construido (e.g. por PromptAssembler).
 * Acepta systemInstruction separada para pasarla nativamente a Gemini.
 */
export async function generateResponseFromPrompt(userPrompt, systemInstruction = null) {
    const safePrompt = typeof userPrompt === 'string' ? userPrompt : String(userPrompt ?? '');
    return generate(safePrompt, RESPONSE_OPTIONS, systemInstruction);
}

export async function generateResponseStreamFromPrompt(userPrompt, onChunk, systemInstruction = null) {
    const safePrompt = typeof userPrompt === 'string' ? userPrompt : String(userPrompt ?? '');
    return generateStream(safePrompt, STREAM_OPTIONS, onChunk, systemInstruction);
}
