import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { metricsService } from '../services/api';
import './MetricsPage.css';

const WINDOW_OPTIONS = [
  { label: '24h', value: 24 },
  { label: '72h', value: 72 },
  { label: '168h', value: 168 },
];

const METHOD_ORDER = ['semantic', 'hybrid', 'rerank'];
const JOB_KEYS = ['pending', 'running', 'done', 'error'];

function getValueAtPath(source, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }
    return acc[key];
  }, source);
}

function getFirstNumeric(sources, paths) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const path of paths) {
      const value = getValueAtPath(source, path);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }
  }

  return null;
}

function getFirstObject(sources, paths) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const path of paths) {
      const value = getValueAtPath(source, path);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
    }
  }

  return null;
}

function normalizeByMethod(payload) {
  const directByMethod = getValueAtPath(payload, 'byMethod');
  const nestedByMethod = getFirstObject(
    [payload],
    ['overview.byMethod', 'data.byMethod', 'metrics.byMethod', 'methods', 'breakdown.byMethod']
  );

  const source = directByMethod ?? nestedByMethod ?? {};

  let rows = [];

  if (Array.isArray(source)) {
    rows = source
      .map((item) => ({
        method: String(item.method || item.name || '').toLowerCase(),
        count: getFirstNumeric([item], ['count', 'requests', 'hits', 'total']),
        avgLatencyMs: getFirstNumeric([item], ['avgLatencyMs', 'avgMs', 'latency.avgMs', 'latency.avg']),
        p95LatencyMs: getFirstNumeric([item], ['p95LatencyMs', 'p95Ms', 'latency.p95Ms', 'latency.p95']),
      }))
      .filter((item) => item.method);
  } else {
    rows = Object.entries(source).map(([method, value]) => ({
      method: method.toLowerCase(),
      count: getFirstNumeric([value], ['count', 'requests', 'hits', 'total']),
      avgLatencyMs: getFirstNumeric([value], ['avgLatencyMs', 'avgMs', 'latency.avgMs', 'latency.avg']),
      p95LatencyMs: getFirstNumeric([value], ['p95LatencyMs', 'p95Ms', 'latency.p95Ms', 'latency.p95']),
    }));
  }

  const rowMap = new Map(rows.map((row) => [row.method, row]));

  return METHOD_ORDER.map((method) => (
    rowMap.get(method) || {
      method,
      count: null,
      avgLatencyMs: null,
      p95LatencyMs: null,
    }
  ));
}

function formatMetric(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  if (unit === 'ms') {
    return `${Math.round(value)} ms`;
  }

  return Math.round(value).toLocaleString('es-ES');
}

export default function MetricsPage() {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await metricsService.overview(hours);
      setMetrics(payload || {});
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las metricas de observabilidad.');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const normalized = useMemo(() => {
    const sourceCandidates = [metrics, metrics?.overview, metrics?.data, metrics?.metrics].filter(Boolean);

    const ttftP50 = getFirstNumeric(sourceCandidates, [
      'ttft.p50Ms',
      'ttft.p50',
      'ttftP50Ms',
      'stageLatencies.ttft.p50Ms',
      'stageLatencies.ttfb.p50Ms',
    ]);

    const ttftP95 = getFirstNumeric(sourceCandidates, [
      'ttft.p95Ms',
      'ttft.p95',
      'ttftP95Ms',
      'stageLatencies.ttft.p95Ms',
      'stageLatencies.ttfb.p95Ms',
    ]);

    const avgEmbeddingDuration = getFirstNumeric(sourceCandidates, [
      'embeddings.avgDurationMs',
      'embedding.avgDurationMs',
      'embeddingDuration.avgMs',
      'avgEmbeddingDurationMs',
    ]);

    const p95EmbeddingDuration = getFirstNumeric(sourceCandidates, [
      'embeddings.p95DurationMs',
      'embedding.p95DurationMs',
      'embeddingDuration.p95Ms',
      'p95EmbeddingDurationMs',
    ]);

    const avgHits = getFirstNumeric(sourceCandidates, [
      'retrieval.avgHits',
      'avgHits',
      'search.avgHits',
      'hits.avg',
    ]);

    const jobsSource = getFirstObject(sourceCandidates, [
      'jobs',
      'embeddingJobs',
      'jobStatus',
      'embeddings.jobs',
    ]) || {};

    const jobs = JOB_KEYS.reduce((acc, key) => {
      acc[key] = getFirstNumeric([jobsSource], [key, `${key}Count`, `${key}_count`]) ?? 0;
      return acc;
    }, {});

    const byMethod = normalizeByMethod(metrics || {});

    return {
      ttftP50,
      ttftP95,
      avgEmbeddingDuration,
      p95EmbeddingDuration,
      avgHits,
      jobs,
      byMethod,
    };
  }, [metrics]);

  const hasData = useMemo(() => {
    const kpiHasData = [
      normalized.ttftP50,
      normalized.ttftP95,
      normalized.avgEmbeddingDuration,
      normalized.p95EmbeddingDuration,
      normalized.avgHits,
    ].some((value) => value !== null);

    const jobsHasData = Object.values(normalized.jobs).some((value) => value > 0);
    const methodHasData = normalized.byMethod.some((row) => (row.count ?? 0) > 0);

    return kpiHasData || jobsHasData || methodHasData;
  }, [normalized]);

  return (
    <div className="page-shell metrics-page">
      <header className="metrics-page__header">
        <div>
          <span className="app-eyebrow">Observabilidad</span>
          <h1>Metrica operativa</h1>
          <p>Validacion rapida de TTFT, embeddings y recuperacion por metodo.</p>
        </div>

        <div className="metrics-window" role="group" aria-label="Seleccionar ventana temporal">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`metrics-window__button${hours === option.value ? ' is-active' : ''}`}
              onClick={() => setHours(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {error && !metrics && !loading && (
        <section className="metrics-state-card metrics-state-card--error" aria-live="polite">
          <p>{error}</p>
          <button type="button" className="secondary-btn" onClick={fetchOverview}>
            Reintentar
          </button>
        </section>
      )}

      {loading && !metrics && (
        <section className="metrics-state-card" aria-live="polite">
          <p>Cargando resumen de metricas...</p>
        </section>
      )}

      {!loading && !error && !hasData && (
        <section className="metrics-state-card" aria-live="polite">
          <p>Sin datos aun para la ventana seleccionada. Genera trafico y vuelve a intentar.</p>
        </section>
      )}

      {metrics && (
        <>
          {error && <div className="metrics-banner-error">{error}</div>}

          <section className="metrics-kpi-grid" aria-label="KPIs principales">
            <article className="metrics-kpi-card">
              <h2>TTFT p50</h2>
              <p>{formatMetric(normalized.ttftP50, 'ms')}</p>
            </article>
            <article className="metrics-kpi-card">
              <h2>TTFT p95</h2>
              <p>{formatMetric(normalized.ttftP95, 'ms')}</p>
            </article>
            <article className="metrics-kpi-card">
              <h2>Embedding avg</h2>
              <p>{formatMetric(normalized.avgEmbeddingDuration, 'ms')}</p>
            </article>
            <article className="metrics-kpi-card">
              <h2>Embedding p95</h2>
              <p>{formatMetric(normalized.p95EmbeddingDuration, 'ms')}</p>
            </article>
            <article className="metrics-kpi-card">
              <h2>Avg hits</h2>
              <p>{formatMetric(normalized.avgHits)}</p>
            </article>
          </section>

          <section className="metrics-jobs" aria-label="Estado de jobs de embeddings">
            <h2>Jobs de embeddings</h2>
            <div className="metrics-jobs-grid">
              {JOB_KEYS.map((status) => (
                <article key={status} className={`metrics-job-card metrics-job-card--${status}`}>
                  <span>{status}</span>
                  <strong>{normalized.jobs[status]}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="metrics-table-section" aria-label="Metricas por metodo de retrieval">
            <h2>Latencias por metodo</h2>
            <div className="metrics-table-wrap">
              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Metodo</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Avg latency</th>
                    <th className="text-right">P95 latency</th>
                  </tr>
                </thead>
                <tbody>
                  {normalized.byMethod.map((row) => (
                    <tr key={row.method}>
                      <td>{row.method}</td>
                      <td className="text-right">{formatMetric(row.count)}</td>
                      <td className="text-right">{formatMetric(row.avgLatencyMs, 'ms')}</td>
                      <td className="text-right">{formatMetric(row.p95LatencyMs, 'ms')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
