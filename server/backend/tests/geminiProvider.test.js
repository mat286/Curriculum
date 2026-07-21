import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests del GeminiProvider con el cliente mockeado.
 * No requieren GEMINI_API_KEY ni conexión real a la API.
 */

// Mock de @google/generative-ai antes del import del módulo
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: { text: () => 'respuesta mockeada' },
            }),
            generateContentStream: vi.fn().mockResolvedValue({
                stream: (async function* () { yield { text: () => 'token ' }; })(),
            }),
        }),
    })),
}));

// Mock de config/gemini.js
vi.mock('../config/gemini.js', () => ({
    GEMINI_API_KEY: 'mock-key-for-testing',
    GEMINI_MODEL: 'gemini-pro',
    GEMINI_TIMEOUT: 5000,
}));

// Mock del logger para no ensuciar output
vi.mock('../utils/logger.js', () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

import { GeminiProvider } from '../ai/GeminiProvider.js';

describe('GeminiProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new GeminiProvider();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('se instancia correctamente', () => {
        expect(provider).toBeInstanceOf(GeminiProvider);
    });

    it('isInQuotaCooldown() es false inicialmente', () => {
        expect(provider.isInQuotaCooldown()).toBe(false);
    });

    it('activa cooldown y lo detecta', () => {
        provider.activateQuotaCooldown(60000);
        expect(provider.isInQuotaCooldown()).toBe(true);
    });

    it('cooldown expirado ya no está activo', () => {
        provider._quotaCooldownUntil = Date.now() - 1000;
        expect(provider.isInQuotaCooldown()).toBe(false);
    });

    it('isQuotaError detecta error 429', () => {
        expect(provider.isQuotaError({ message: 'Error 429 Too Many Requests' })).toBe(true);
    });

    it('isQuotaError detecta RESOURCE_EXHAUSTED', () => {
        expect(provider.isQuotaError({ message: 'RESOURCE_EXHAUSTED' })).toBe(true);
    });

    it('isQuotaError devuelve false para otros errores', () => {
        expect(provider.isQuotaError({ message: 'Network error' })).toBe(false);
    });

    it('isOverloadedError detecta status 503', () => {
        expect(provider.isOverloadedError({ status: 503, message: 'algo' })).toBe(true);
    });

    it('isOverloadedError detecta mensaje de alta demanda de Google', () => {
        expect(provider.isOverloadedError({ message: '[503 Service Unavailable] This model is currently experiencing high demand.' })).toBe(true);
    });

    it('isOverloadedError devuelve false para otros errores', () => {
        expect(provider.isOverloadedError({ message: 'RESOURCE_EXHAUSTED' })).toBe(false);
    });

    it('generate() produce texto con el cliente mockeado', async () => {
        const result = await provider.generate('Hola, ¿cómo estás?');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('generate() lanza LLMError si el prompt está vacío', async () => {
        await expect(provider.generate('')).rejects.toThrow('prompt');
    });

    it('generate() lanza LLMError si el prompt no es string', async () => {
        await expect(provider.generate(null)).rejects.toThrow();
    });
});
