export function initSSE(res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.socket?.setNoDelay(true);

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const finish = (meta = {}) => {
        send({ done: true, ...meta });
        res.end();
    };

    return { send, finish };
}
