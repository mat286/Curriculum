/**
 * Utilidades compartidas para los controladores de chat.
 */

/**
 * Carrera entre una promesa y un timeout.
 * Si la promesa no resuelve en `ms` ms, resuelve con `fallback`.
 */
export function withTimeout(promise, ms, fallback) {
    let timer;
    return Promise.race([
        promise,
        new Promise(resolve => {
            timer = setTimeout(() => resolve(fallback), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

/**
 * Crea una caché en memoria con TTL y límite de tamaño (LRU simple).
 * @param {number} ttlMs   - Tiempo de vida de cada entrada en milisegundos.
 * @param {number} maxSize - Máximo de entradas permitidas (default 500).
 */
export function createCache(ttlMs, maxSize = 500) {
    const store = new Map();

    function evictExpired() {
        const now = Date.now();
        for (const [k, v] of store) {
            if (now - v.timestamp > ttlMs) store.delete(k);
        }
    }

    function get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > ttlMs) {
            store.delete(key);
            return null;
        }
        // Refresh para comportamiento LRU: mover al final
        store.delete(key);
        store.set(key, entry);
        return entry.payload;
    }

    function set(key, payload) {
        if (store.size >= maxSize) {
            evictExpired();
            // Si sigue lleno, eliminar la entrada más antigua (primera del Map)
            if (store.size >= maxSize) {
                const oldest = store.keys().next().value;
                store.delete(oldest);
            }
        }
        store.set(key, { timestamp: Date.now(), payload });
    }

    return { get, set, size: () => store.size };
}
