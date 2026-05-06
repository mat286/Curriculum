import React from 'react';
import './StreamingIndicator.css';

/**
 * Componente visual para mostrar estado de streaming.
 * 
 * Estados:
 * - thinking: spinner pulsante + "Pensando..."
 * - streaming: token flow animation + "Streaming..." + TTFT display
 * - done: fade out
 * - error: error message + retry button
 * 
 * @component
 * @param {Object} props
 * @param {string} props.status - Estado: 'idle'|'acking'|'thinking'|'streaming'|'done'|'error'
 * @param {number} props.ttft - TTFT en ms (mostrar cuando > 0)
 * @param {number} props.thinkingMs - Tiempo de pensamiento en ms
 * @param {string} props.errorMessage - Mensaje de error (si status=error)
 * @param {Function} props.onRetry - Callback para botón retry
 */
const StreamingIndicator = ({
  status = 'idle',
  ttft = null,
  thinkingMs = null,
  errorMessage = null,
  onRetry = null,
}) => {
  const formatMs = (ms) => {
    if (ms === null || ms === undefined) return null;
    return (ms / 1000).toFixed(2) + 's';
  };

  // Estado idle: no mostrar nada
  if (status === 'idle') {
    return null;
  }

  // Estado thinking: spinner pulsante + text
  if (status === 'acking' || status === 'thinking') {
    return (
      <div className="streaming-indicator streaming-indicator--thinking">
        <div className="streaming-spinner">
          <div className="streaming-spinner-dot streaming-spinner-dot--1" />
          <div className="streaming-spinner-dot streaming-spinner-dot--2" />
          <div className="streaming-spinner-dot streaming-spinner-dot--3" />
        </div>
        <span className="streaming-text">Pensando...</span>
        {thinkingMs !== null && (
          <span className="streaming-metric">
            ({formatMs(thinkingMs)})
          </span>
        )}
      </div>
    );
  }

  // Estado streaming: animated token flow + TTFT
  if (status === 'streaming' || status === 'generating') {
    return (
      <div className="streaming-indicator streaming-indicator--streaming">
        <div className="streaming-tokens">
          <div className="streaming-token streaming-token--1" />
          <div className="streaming-token streaming-token--2" />
          <div className="streaming-token streaming-token--3" />
        </div>
        <span className="streaming-text">Streaming respuesta...</span>
        {ttft !== null && (
          <span className="streaming-metric streaming-metric--ttft">
            Listo en {formatMs(ttft)}
          </span>
        )}
      </div>
    );
  }

  // Estado finalizing: fade out smooth
  if (status === 'finalizing') {
    return (
      <div className="streaming-indicator streaming-indicator--finalizing">
        <div className="streaming-spinner">
          <div className="streaming-spinner-dot streaming-spinner-dot--1" />
          <div className="streaming-spinner-dot streaming-spinner-dot--2" />
          <div className="streaming-spinner-dot streaming-spinner-dot--3" />
        </div>
        <span className="streaming-text">Finalizando...</span>
      </div>
    );
  }

  // Estado error: message + retry button
  if (status === 'error') {
    return (
      <div className="streaming-indicator streaming-indicator--error">
        <div className="streaming-error-icon">⚠️</div>
        <span className="streaming-error-text">
          {errorMessage || 'Error en la solicitud'}
        </span>
        {onRetry && (
          <button
            className="streaming-retry-button"
            onClick={onRetry}
            type="button"
            title="Reintentar solicitud"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  // Estado done: desvanecerse smooth
  if (status === 'done') {
    return (
      <div className="streaming-indicator streaming-indicator--done">
        <span className="streaming-text">✓ Completado</span>
      </div>
    );
  }

  return null;
};

export default StreamingIndicator;
