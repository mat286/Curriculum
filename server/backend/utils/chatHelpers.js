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
 * Crea una caché en memoria con TTL.
 * @param {number} ttlMs - Tiempo de vida de cada entrada en milisegundos.
 */
export function createCache(ttlMs) {
    const store = new Map();

    function get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > ttlMs) {
            store.delete(key);
            return null;
        }
        return entry.payload;
    }

    function set(key, payload) {
        store.set(key, { timestamp: Date.now(), payload });
    }

    return { get, set };
}
