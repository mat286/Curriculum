import { describe, it, expect, vi } from 'vitest';
import { createCache, withTimeout } from '../utils/chatHelpers.js';

describe('createCache', () => {
    it('almacena y recupera un valor', () => {
        const cache = createCache(5000);
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
    });

    it('devuelve null para clave inexistente', () => {
        const cache = createCache(5000);
        expect(cache.get('no-existe')).toBeNull();
    });

    it('expira entradas tras el TTL', async () => {
        const cache = createCache(50); // 50ms TTL
        cache.set('key', 'data');
        await new Promise((r) => setTimeout(r, 80));
        expect(cache.get('key')).toBeNull();
    });

    it('respeta el límite de tamaño (maxSize)', () => {
        const cache = createCache(5000, 3);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.set('d', 4); // debe evictar 'a'
        expect(cache.size()).toBeLessThanOrEqual(3);
    });

    it('acepta objetos como valor', () => {
        const cache = createCache(5000);
        const obj = { x: 1, y: [2, 3] };
        cache.set('obj', obj);
        expect(cache.get('obj')).toEqual(obj);
    });
});

describe('withTimeout', () => {
    it('resuelve con el valor de la promesa si llega a tiempo', async () => {
        const fast = Promise.resolve('ok');
        const result = await withTimeout(fast, 500, 'fallback');
        expect(result).toBe('ok');
    });

    it('devuelve fallback si la promesa es más lenta que el timeout', async () => {
        const slow = new Promise((r) => setTimeout(() => r('tarde'), 300));
        const result = await withTimeout(slow, 50, 'fallback');
        expect(result).toBe('fallback');
    });

    it('devuelve fallback null si no se especifica fallback', async () => {
        const slow = new Promise((r) => setTimeout(() => r('tarde'), 300));
        const result = await withTimeout(slow, 50, null);
        expect(result).toBeNull();
    });
});
