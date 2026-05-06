import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TelemetryChart from '../components/TelemetryChart';
import './TelemetryDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function TelemetryDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const getFirstNumeric = (sources, paths) => {
    for (const source of sources) {
      if (!source) continue;

      for (const path of paths) {
        const value = path
          .split('.')
          .reduce((acc, key) => (acc !== null && acc !== undefined ? acc[key] : undefined), source);

        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
      }
    }

    return null;
  };

  // Fetch metrics from backend
  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics`);
      if (response.data) {
        setMetrics(response.data);
        setError(null);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'No se pudieron cargar las métricas. Verifica que el backend esté disponible.'
      );
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and set up polling interval
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="page-shell telemetry-dashboard">
        <div className="telemetry-loading">
          <div className="loading-card">
            <span className="app-eyebrow">Telemetría en vivo</span>
            <div className="loading">Cargando métricas del sistema...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="page-shell telemetry-dashboard">
        <div className="telemetry-error">
          <div className="error-card">
            <span className="app-eyebrow">⚠️ Error</span>
            <p className="error-message">{error}</p>
            <button onClick={fetchMetrics} className="retry-btn">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const stageLatencies = metrics.stageLatencies || {};
  const promptStats = metrics.promptStats || {};

  const ttftP50 = getFirstNumeric(
    [stageLatencies, metrics],
    ['ttft.p50', 'ttft.p50Ms', 'ttftP50', 'ttftP50Ms']
  );
  const ttftP95 = getFirstNumeric(
    [stageLatencies, metrics],
    ['ttft.p95', 'ttft.p95Ms', 'ttftP95', 'ttftP95Ms']
  );
  const semanticP50 = getFirstNumeric(
    [stageLatencies, metrics],
    ['semantic.p50', 'semantic.p50Ms', 'semanticP50', 'semanticP50Ms']
  );
  const semanticP95 = getFirstNumeric(
    [stageLatencies, metrics],
    ['semantic.p95', 'semantic.p95Ms', 'semanticP95', 'semanticP95Ms']
  );

  const promptAvgChars = getFirstNumeric(
    [promptStats, metrics],
    ['avgChars', 'avg_chars', 'averageChars']
  );
  const promptP95Chars = getFirstNumeric(
    [promptStats, metrics],
    ['p95Chars', 'p95_chars']
  );

  // Calculate trends (mock data - in production, track history)
  const errorTrend = metrics.errorRate > 2 ? '↑' : metrics.errorRate > 0 ? '→' : '↓';
  const latencyTrend = metrics.avgLatencyMs > 500 ? '↑' : metrics.avgLatencyMs > 300 ? '→' : '↓';
  const cacheTrend = metrics.avgCacheHitRate > 70 ? '↑' : metrics.avgCacheHitRate > 50 ? '→' : '↓';

  // Calculate total requests from routes
  const totalRouteRequests =
    (metrics.routes?.['l1-greeting'] || 0) +
    (metrics.routes?.['faq-direct'] || 0) +
    (metrics.routes?.['llm'] || 0);

  // Calculate route percentages
  const getRoutePercentage = (count) => {
    if (totalRouteRequests === 0) return 0;
    return ((count / totalRouteRequests) * 100).toFixed(1);
  };

  // Calculate top intents
  const topIntentsArray = metrics.topIntents
    ? Object.entries(metrics.topIntents)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    : [];

  const totalIntentRequests = topIntentsArray.reduce((sum, item) => sum + item.count, 0);

  // Format last update time
  const formatUpdateTime = () => {
    if (!lastUpdate) return '';
    const now = new Date();
    const diff = now - lastUpdate;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `Hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `Hace ${minutes}m`;
  };

  return (
    <div className="page-shell telemetry-dashboard">
      {/* Header */}
      <div className="telemetry-header">
        <div className="telemetry-title-group">
          <h1>📊 Dashboard de Telemetría</h1>
          <p className="telemetry-subtitle">Métricas del sistema en tiempo real</p>
        </div>
        {lastUpdate && (
          <div className="telemetry-last-update">
            Actualizado: {formatUpdateTime()}
          </div>
        )}
      </div>

      {/* Error banner if there was an error in recent fetch */}
      {error && (
        <div className="telemetry-error-banner">
          <p>⚠️ {error}</p>
          <button onClick={fetchMetrics} className="retry-btn-small">
            Reintentar
          </button>
        </div>
      )}

      {/* Section 1: Overview KPIs */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Visión General</h2>
        <div className="telemetry-grid">
          <TelemetryChart
            title="Uptime"
            value={metrics.uptime || 0}
            unit="time"
            color="success"
          />
          <TelemetryChart
            title="Latencia Promedio"
            value={metrics.avgLatencyMs || 0}
            unit="ms"
            trend={latencyTrend}
            color="primary"
          />
          <TelemetryChart
            title="Error Rate"
            value={metrics.errorRate || 0}
            unit="%"
            trend={errorTrend}
            color={metrics.errorRate > 5 ? 'danger' : 'warning'}
          />
          <TelemetryChart
            title="Cache Hit Rate"
            value={metrics.avgCacheHitRate || 0}
            unit="%"
            trend={cacheTrend}
            color="success"
          />
        </div>
      </section>

      {/* Section 2: Percentile Latencies */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Percentiles de Latencia</h2>
        <div className="telemetry-grid">
          <TelemetryChart
            title="Latencia P50 (Promedio)"
            value={metrics.avgLatencyMs || 0}
            unit="ms"
            color="primary"
          />
          <TelemetryChart
            title="Latencia P95"
            value={metrics.p95LatencyMs || 0}
            unit="ms"
            color="warning"
          />
          <TelemetryChart
            title="Latencia P99"
            value={metrics.p99LatencyMs || 0}
            unit="ms"
            color={metrics.p99LatencyMs > 2000 ? 'danger' : 'warning'}
          />
        </div>
      </section>

      {/* Section 3: Stage Latencies */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Latencias por Etapa</h2>
        <div className="telemetry-grid">
          <TelemetryChart
            title="TTFT P50"
            value={ttftP50}
            unit={ttftP50 === null ? undefined : 'ms'}
            color="primary"
          />
          <TelemetryChart
            title="TTFT P95"
            value={ttftP95}
            unit={ttftP95 === null ? undefined : 'ms'}
            color="warning"
          />
          <TelemetryChart
            title="Semantic P50"
            value={semanticP50}
            unit={semanticP50 === null ? undefined : 'ms'}
            color="primary"
          />
          <TelemetryChart
            title="Semantic P95"
            value={semanticP95}
            unit={semanticP95 === null ? undefined : 'ms'}
            color="warning"
          />
        </div>
      </section>

      {/* Section 4: Prompt Budget */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Prompt Budget</h2>
        <div className="telemetry-grid">
          <TelemetryChart
            title="Promedio de Caracteres"
            value={promptAvgChars}
            color="primary"
          />
          <TelemetryChart
            title="P95 de Caracteres"
            value={promptP95Chars}
            color="warning"
          />
        </div>
      </section>

      {/* Section 5: Routes Distribution */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Distribución de Rutas</h2>
        <div className="telemetry-table-container">
          <table className="telemetry-table">
            <thead>
              <tr>
                <th>Ruta</th>
                <th className="text-right">Requests</th>
                <th className="text-right">% del Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>L1 Greeting</td>
                <td className="text-right">{metrics.routes?.['l1-greeting'] || 0}</td>
                <td className="text-right">
                  {getRoutePercentage(metrics.routes?.['l1-greeting'] || 0)}%
                </td>
              </tr>
              <tr>
                <td>FAQ Direct</td>
                <td className="text-right">{metrics.routes?.['faq-direct'] || 0}</td>
                <td className="text-right">
                  {getRoutePercentage(metrics.routes?.['faq-direct'] || 0)}%
                </td>
              </tr>
              <tr>
                <td>LLM</td>
                <td className="text-right">{metrics.routes?.['llm'] || 0}</td>
                <td className="text-right">
                  {getRoutePercentage(metrics.routes?.['llm'] || 0)}%
                </td>
              </tr>
              <tr className="telemetry-table-footer">
                <td>Total</td>
                <td className="text-right">{totalRouteRequests}</td>
                <td className="text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 6: Top Intents */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Top 5 Intents</h2>
        {topIntentsArray.length > 0 ? (
          <div className="telemetry-table-container">
            <table className="telemetry-table">
              <thead>
                <tr>
                  <th>Intent</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">% del Total</th>
                </tr>
              </thead>
              <tbody>
                {topIntentsArray.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.intent}</td>
                    <td className="text-right">{item.count}</td>
                    <td className="text-right">
                      {totalIntentRequests > 0
                        ? ((item.count / totalIntentRequests) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="telemetry-empty-state">
            <p>No hay datos de intents disponibles</p>
          </div>
        )}
      </section>

      {/* Section 7: Live Stats (Last Minute) */}
      <section className="telemetry-section">
        <h2 className="telemetry-section-title">Últimos 60 Segundos</h2>
        <div className="telemetry-grid">
          <TelemetryChart
            title="Requests (Último Min)"
            value={metrics.lastMinute?.requests || 0}
            color="primary"
          />
          <TelemetryChart
            title="Latencia Prom (Último Min)"
            value={metrics.lastMinute?.avgLatencyMs || 0}
            unit="ms"
            color="primary"
          />
          <TelemetryChart
            title="Errores (Último Min)"
            value={metrics.lastMinute?.errors || 0}
            color={metrics.lastMinute?.errors > 0 ? 'danger' : 'success'}
          />
          <TelemetryChart
            title="Requests (Última Hora)"
            value={metrics.lastHour?.requests || 0}
            color="primary"
          />
        </div>
      </section>

      {/* Footer Info */}
      <div className="telemetry-footer">
        <p className="telemetry-footer-text">
          Total Requests: <strong>{metrics.totalRequests || 0}</strong> •
          Actualización automática cada 3 segundos
        </p>
      </div>
    </div>
  );
}
