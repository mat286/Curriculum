import { renderHook, act } from '@testing-library/react';
import { useStreamMetrics } from '../useStreamMetrics';

describe('useStreamMetrics Hook', () => {
  
  test('should initialize with idle status', () => {
    const { result } = renderHook(() => useStreamMetrics());
    
    expect(result.current.metrics.status).toBe('idle');
    expect(result.current.metrics.ttft).toBeNull();
    expect(result.current.metrics.thinkingMs).toBeNull();
    expect(result.current.metrics.generatingMs).toBeNull();
  });

  test('should track ACK event and set status to acking', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const now = Date.now();

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'ack',
        ts: now,
      });
    });

    expect(result.current.metrics.status).toBe('acking');
  });

  test('should calculate thinkingMs from ack to thinking event', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const ackTime = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: ackTime });
    });

    const thinkingTime = ackTime + 250; // 250ms después
    act(() => {
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: thinkingTime,
        payload: { status: 'thinking' },
      });
    });

    expect(result.current.metrics.thinkingMs).toBe(250);
    expect(result.current.metrics.status).toBe('thinking');
  });

  test('should calculate TTFT from ack to first token', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const ackTime = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: ackTime });
    });

    const thinkingTime = ackTime + 150;
    act(() => {
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: thinkingTime,
        payload: { status: 'thinking' },
      });
    });

    const firstTokenTime = ackTime + 500; // 500ms total desde ack
    act(() => {
      result.current.handleStreamEvent({
        eventType: 'token',
        ts: firstTokenTime,
      });
    });

    expect(result.current.metrics.ttft).toBe(500);
    expect(result.current.metrics.generatingMs).toBe(350); // 500 - 150
    expect(result.current.metrics.status).toBe('streaming');
  });

  test('should handle status transitions correctly', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const now = Date.now();

    // ack -> thinking -> generating -> finalizing -> done
    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: now });
    });
    expect(result.current.metrics.status).toBe('acking');

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: now + 100,
        payload: { status: 'thinking' },
      });
    });
    expect(result.current.metrics.status).toBe('thinking');

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: now + 200,
        payload: { status: 'generating' },
      });
    });
    expect(result.current.metrics.status).toBe('generating');

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'token',
        ts: now + 300,
      });
    });
    expect(result.current.metrics.status).toBe('streaming');

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: now + 400,
        payload: { status: 'finalizing' },
      });
    });
    expect(result.current.metrics.status).toBe('finalizing');

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'done',
        ts: now + 500,
      });
    });
    expect(result.current.metrics.status).toBe('done');
  });

  test('should handle errors and set error status', () => {
    const { result } = renderHook(() => useStreamMetrics());

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'error',
        payload: { message: 'Network error' },
      });
    });

    expect(result.current.metrics.status).toBe('error');
    expect(result.current.metrics.errorMessage).toBe('Network error');
  });

  test('should ignore duplicate first token events', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const ackTime = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: ackTime });
      result.current.handleStreamEvent({
        eventType: 'token',
        ts: ackTime + 200,
      });
    });

    const firstTtft = result.current.metrics.ttft;

    act(() => {
      // Simular otro evento de token
      result.current.handleStreamEvent({
        eventType: 'token',
        ts: ackTime + 300,
      });
    });

    // TTFT debe mantenerse igual (solo la primera vez se cuenta)
    expect(result.current.metrics.ttft).toBe(firstTtft);
  });

  test('should reset metrics on reset call', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const now = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: now });
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: now + 100,
        payload: { status: 'thinking' },
      });
      result.current.handleStreamEvent({
        eventType: 'token',
        ts: now + 300,
      });
    });

    expect(result.current.metrics.ttft).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.metrics.status).toBe('idle');
    expect(result.current.metrics.ttft).toBeNull();
    expect(result.current.metrics.thinkingMs).toBeNull();
    expect(result.current.metrics.generatingMs).toBeNull();
  });

  test('should handle heartbeat without changing state', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const now = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: now });
      result.current.handleStreamEvent({
        eventType: 'status',
        ts: now + 100,
        payload: { status: 'thinking' },
      });
    });

    const thinkingMs = result.current.metrics.thinkingMs;

    act(() => {
      result.current.handleStreamEvent({
        eventType: 'heartbeat',
        ts: now + 200,
      });
    });

    // Heartbeat no debe cambiar el estado
    expect(result.current.metrics.status).toBe('thinking');
    expect(result.current.metrics.thinkingMs).toBe(thinkingMs);
  });

  test('should handle chunk eventType as token', () => {
    const { result } = renderHook(() => useStreamMetrics());
    const ackTime = Date.now();

    act(() => {
      result.current.handleStreamEvent({ eventType: 'ack', ts: ackTime });
      result.current.handleStreamEvent({
        eventType: 'chunk',
        ts: ackTime + 200,
      });
    });

    expect(result.current.metrics.ttft).toBe(200);
    expect(result.current.metrics.status).toBe('streaming');
  });
});
