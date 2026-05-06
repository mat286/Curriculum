export function initSSE(res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.socket?.setNoDelay(true);

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let heartbeatTimer = null;

    const writeEvent = (eventType, payload = {}, legacyFields = {}) => {
        if (res.writableEnded || res.destroyed) return;

        const data = {
            eventType,
            requestId,
            ts: Date.now(),
            payload,
            ...legacyFields,
        };

        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    const sendToken = (text) => {
        writeEvent('token', { text }, { token: text });
    };

    const sendStatus = (status, meta = {}) => {
        writeEvent('status', { status, ...meta });
    };

    const sendAck = (meta = {}) => {
        writeEvent('ack', { ...meta });
    };

    const sendMetrics = (meta = {}) => {
        writeEvent('metrics', { ...meta });
    };

    const sendError = (error, retryable = false) => {
        const message = error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : 'Error interno del servidor';

        writeEvent(
            'error',
            { message, retryable: Boolean(retryable) },
            { error: message },
        );
    };

    const startHeartbeat = (intervalMs = 15000) => {
        stopHeartbeat();

        heartbeatTimer = setInterval(() => {
            writeEvent('heartbeat', {});
        }, intervalMs);

        return stopHeartbeat;
    };

    const send = (data) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const finish = (meta = {}) => {
        stopHeartbeat();
        writeEvent('done', { ...meta }, { done: true, ...meta });
        res.end();
    };

    return {
        send,
        sendToken,
        sendStatus,
        sendAck,
        sendMetrics,
        sendError,
        startHeartbeat,
        stopHeartbeat,
        finish,
        requestId,
    };
}
