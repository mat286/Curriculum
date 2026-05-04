import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiLevelCacheService } from '../modules/cache/MultiLevelCacheService.js';

describe('MultiLevelCacheService', () => {
    let cache;

    beforeEach(() => {
        cache = new MultiLevelCacheService();
    });

    // ── L1: Greetings ──────────────────────────────────────────────
    describe('getGreeting (L1)', () => {
        it('reconoce "hola"', () => {
            const result = cache.getGreeting('hola', 'Martín');
            expect(result).toContain('Martín');
        });

        it('reconoce "buenos días"', () => {
            const result = cache.getGreeting('buenos días', 'Ana');
            expect(result).toContain('Ana');
        });

        it('reconoce "gracias"', () => {
            const result = cache.getGreeting('gracias', 'Carlos');
            expect(result).not.toBeNull();
        });

        it('devuelve null para preguntas que no son saludos', () => {
            expect(cache.getGreeting('¿cuál es tu experiencia?', 'X')).toBeNull();
        });

        it('devuelve null para string vacío', () => {
            expect(cache.getGreeting('', 'X')).toBeNull();
        });

        it('ignora espacios y puntuación en saludo', () => {
            const result = cache.getGreeting('hola!', 'Pedro');
            expect(result).not.toBeNull();
        });
    });

    // ── L2: Semantic cache ─────────────────────────────────────────
    describe('caché semántico (L2)', () => {
        it('devuelve null si no hay nada cacheado', () => {
            const key = cache.buildKey(1, 'pregunta de prueba');
            expect(cache.getSemantic(key)).toBeNull();
        });

        it('almacena y recupera un payload semántico', () => {
            const key = cache.buildKey(1, 'test');
            const payload = { context: 'texto de contexto' };
            cache.setSemantic(key, payload);
            expect(cache.getSemantic(key)).toEqual(payload);
        });
    });

    // ── L3: Response cache ─────────────────────────────────────────
    describe('caché de respuesta final (L3)', () => {
        it('devuelve null si no hay respuesta cacheada', () => {
            const key = cache.buildKey(99, 'pregunta nueva');
            expect(cache.getResponse(key)).toBeNull();
        });

        it('almacena y recupera una respuesta', () => {
            const key = cache.buildKey(99, 'pregunta');
            const response = 'Esta es la respuesta';
            cache.setResponse(key, response);
            expect(cache.getResponse(key)).toBe(response);
        });

        it('buildKey genera keys distintas para candidatos distintos', () => {
            const k1 = cache.buildKey(1, 'hola');
            const k2 = cache.buildKey(2, 'hola');
            expect(k1).not.toBe(k2);
        });

        it('buildKey normaliza la pregunta (lowercase, trim)', () => {
            const k1 = cache.buildKey(1, '  HOLA  ');
            const k2 = cache.buildKey(1, 'hola');
            expect(k1).toBe(k2);
        });
    });
});
