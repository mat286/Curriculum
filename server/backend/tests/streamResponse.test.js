import { describe, it, expect, vi } from 'vitest';
import { initSSE } from '../modules/chat/StreamResponse.js';

function createMockResponse() {
    const writes = [];
    const headers = {};

    const res = {
        writableEnded: false,
        destroyed: false,
        socket: { setNoDelay: vi.fn() },
        setHeader: vi.fn((key, value) => {
            headers[key] = value;
        }),
        flushHeaders: vi.fn(),
        write: vi.fn((chunk) => {
            writes.push(chunk);
        }),
        end: vi.fn(() => {
            res.writableEnded = true;
        }),
    };

    return { res, writes, headers };
}

function parseSSEData(raw) {
    return JSON.parse(raw.replace(/^data:\s*/, '').trim());
}

describe('StreamResponse', () => {
    it('sendToken conserva token legacy y eventType=token', () => {
        const { res, writes } = createMockResponse();
        const stream = initSSE(res);

        stream.sendToken('hola mundo');

        const event = parseSSEData(writes[0]);
        expect(event.eventType).toBe('token');
        expect(event.token).toBe('hola mundo');
        expect(event.payload.text).toBe('hola mundo');
    });

    it('finish conserva done=true', () => {
        const { res, writes } = createMockResponse();
        const stream = initSSE(res);

        stream.finish({ routed: 'with_data' });

        const event = parseSSEData(writes[0]);
        expect(event.eventType).toBe('done');
        expect(event.done).toBe(true);
        expect(event.payload.routed).toBe('with_data');
        expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('sendError conserva error legacy', () => {
        const { res, writes } = createMockResponse();
        const stream = initSSE(res);

        stream.sendError('fallo de prueba');

        const event = parseSSEData(writes[0]);
        expect(event.eventType).toBe('error');
        expect(event.error).toBe('fallo de prueba');
        expect(event.payload.message).toBe('fallo de prueba');
    });

    it('sendMetrics expone ttfbMs, totalMs y routed en payload (contrato TTFT)', () => {
        const { res, writes } = createMockResponse();
        const stream = initSSE(res);

        stream.sendMetrics({ ttfbMs: 320, totalMs: 1100, routed: 'with_data', cached: false });

        const event = parseSSEData(writes[0]);
        expect(event.eventType).toBe('metrics');
        expect(event.payload.ttfbMs).toBe(320);
        expect(event.payload.totalMs).toBe(1100);
        expect(event.payload.routed).toBe('with_data');
        expect(event.payload.cached).toBe(false);
    });
});