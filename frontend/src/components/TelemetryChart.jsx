import React from 'react';
import './TelemetryChart.css';

export default function TelemetryChart({ title, value, unit, trend, color = 'primary' }) {
  const formatValue = () => {
    if (value === null || value === undefined || isNaN(value)) {
      return '—';
    }
    
    // Si es porcentaje
    if (unit === '%') {
      return `${parseFloat(value).toFixed(1)}%`;
    }
    
    // Si es latencia (ms)
    if (unit === 'ms') {
      return `${Math.round(value)}ms`;
    }
    
    // Si es tiempo HH:MM:SS
    if (unit === 'time') {
      const totalSeconds = Math.floor(value / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // Números normales
    return Math.round(value).toLocaleString('es-ES');
  };

  const getTrendIcon = () => {
    if (trend === '↑') return '📈';
    if (trend === '↓') return '📉';
    return '→';
  };

  return (
    <div className={`telemetry-chart telemetry-chart--${color}`}>
      <div className="telemetry-chart-header">
        <h3 className="telemetry-chart-title">{title}</h3>
        {trend && <span className="telemetry-chart-trend">{getTrendIcon()}</span>}
      </div>
      <div className="telemetry-chart-value">
        {formatValue()}
        {unit && <span className="telemetry-chart-unit">{unit}</span>}
      </div>
    </div>
  );
}
