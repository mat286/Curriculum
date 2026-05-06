import { useState, useCallback, useRef } from 'react';

/**
 * Hook para capturar y exponer métricas de streaming en tiempo real.
 * 
 * Calcula:
 * - ttft: tiempo desde ack hasta primer token
 * - thinkingMs: tiempo desde ack hasta status='thinking' 
 * - generatingMs: tiempo desde thinking hasta primer token
 * - status: estado actual del streaming
 * 
 * @returns {Object} { metrics, handleStreamEvent }
 */
export const useStreamMetrics = () => {
  const [metrics, setMetrics] = useState({
    ttft: null,           // TTFT percibido (ack -> primer token)
    thinkingMs: null,     // Tiempo de "pensamiento" inicial
    generatingMs: null,   // Tiempo Gemini (thinking -> first token)
    status: 'idle',       // idle | acking | thinking | streaming | done | error
    errorMessage: null,
  });

  const timestampsRef = useRef(new Map()).current;

  const handleStreamEvent = useCallback((event) => {
    const { eventType, ts, payload = {} } = event;
    const eventTs = ts || Date.now();

    // Iniciar referencias de tiempo
    if (!timestampsRef.has('startTime')) {
      timestampsRef.set('startTime', Date.now());
    }

    const startTime = timestampsRef.get('startTime');

    // ACK: request aceptado por backend
    if (eventType === 'ack') {
      timestampsRef.set('ackTime', eventTs);
      setMetrics((prev) => ({
        ...prev,
        status: 'acking',
        errorMessage: null,
      }));
      return;
    }

    // STATUS: cambios de fase (thinking, retrieving, generating, finalizing)
    if (eventType === 'status') {
      const statusValue = payload?.status || payload?.phase || event.status;
      
      if (statusValue === 'thinking' || statusValue === 'retrieving') {
        const ackTime = timestampsRef.get('ackTime');
        const thinkingTime = eventTs;
        
        if (ackTime) {
          timestampsRef.set('thinkingTime', thinkingTime);
          const thinkingMs = Math.round(thinkingTime - ackTime);
          
          setMetrics((prev) => ({
            ...prev,
            thinkingMs,
            status: 'thinking',
            errorMessage: null,
          }));
        }
      }

      if (statusValue === 'generating') {
        setMetrics((prev) => ({
          ...prev,
          status: 'generating',
          errorMessage: null,
        }));
      }

      if (statusValue === 'finalizing') {
        setMetrics((prev) => ({
          ...prev,
          status: 'finalizing',
          errorMessage: null,
        }));
      }

      return;
    }

    // TOKEN: primer token = TTFT!
    if (eventType === 'token' || eventType === 'chunk') {
      if (!timestampsRef.has('firstTokenTime')) {
        const firstTokenTime = eventTs;
        timestampsRef.set('firstTokenTime', firstTokenTime);

        const ackTime = timestampsRef.get('ackTime');
        const thinkingTime = timestampsRef.get('thinkingTime');

        let ttft = null;
        let generatingMs = null;

        if (ackTime) {
          ttft = Math.round(firstTokenTime - ackTime);
        }

        if (thinkingTime) {
          generatingMs = Math.round(firstTokenTime - thinkingTime);
        }

        setMetrics((prev) => ({
          ...prev,
          ttft,
          generatingMs,
          status: 'streaming',
          errorMessage: null,
        }));
      }
      return;
    }

    // DONE: finalización exitosa
    if (eventType === 'done') {
      setMetrics((prev) => ({
        ...prev,
        status: 'done',
        errorMessage: null,
      }));
      // Limpiar timestamps para próximo evento
      timestampsRef.clear();
      return;
    }

    // ERROR: capturar error y mantener información
    if (eventType === 'error') {
      const errorMsg = payload?.message || payload?.error || event.error || 'Error en streaming';
      
      setMetrics((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: errorMsg,
      }));
      timestampsRef.clear();
      return;
    }

    // HEARTBEAT: mantener vivo pero sin cambiar estado
    if (eventType === 'heartbeat') {
      return;
    }
  }, []);

  const reset = useCallback(() => {
    setMetrics({
      ttft: null,
      thinkingMs: null,
      generatingMs: null,
      status: 'idle',
      errorMessage: null,
    });
    timestampsRef.clear();
  }, []);

  return { metrics, handleStreamEvent, reset };
};
