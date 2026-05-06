/**
 * retryUtils.js
 * Utilidades de retry compartidas entre controllers y providers.
 */

/**
 * Determina si un error es reintentable (5xx, 429, timeout, red).
 * @param {Error} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
    if (!error) return false;
    if (error.retryable === true) return true;
    if (error.name === 'AbortError') return true;

    const status = error?.status || error?.statusCode;
    if (typeof status === 'number') {
        return status >= 500 || status === 429 || status === 408;
    }

    const code = error?.code;
    if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED') return true;

    const message = String(error.message || '').toLowerCase();
    return message.includes('fetch failed')
        || message.includes('econnreset')
        || message.includes('etimedout')
        || message.includes('socket hang up');
}
