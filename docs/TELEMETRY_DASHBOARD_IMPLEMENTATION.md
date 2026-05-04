# Dashboard de Telemetría en Tiempo Real - Implementación Completa

## 📊 Resumen de Cambios

Se ha implementado un sistema completo de recolección y agregación de métricas en tiempo real para el backend de "CV Conversacional IA". El sistema captura datos automáticamente de `ChatTelemetry` y los expone a través de una API REST.

## 📁 Archivos Creados

### 1. `server/backend/modules/telemetry/MetricsAggregatorService.js`
**Clase Singleton**: Recolecta y agrega estadísticas de telemetría en memoria.

**Métodos principales**:
- `recordTelemetry(telemetryObject)` — Registra datos desde ChatTelemetry
- `getMetrics()` — Retorna métricas compiladas con estadísticas en tiempo real
- `reset()` — Limpia todos los registros
- `getRawRecords(limit)` — Retorna registros sin procesar (debugging)

**Capacidades**:
- Almacena últimas 1000 llamadas en memoria
- Calcula percentiles (p95, p99)
- Filtra por ventanas de tiempo (última hora, último minuto)
- Detecta tasa de errores automáticamente
- Agrupa por rutas y calcula distribuciones

---

### 2. `server/backend/config/metricsAggregator.js`
Exporta el singleton único de `MetricsAggregatorService` para uso global.

```javascript
import metricsAggregator from './config/metricsAggregator.js';
// metricsAggregator es la instancia única en toda la app
```

---

### 3. `server/backend/routes/metrics.js`
Define 4 endpoints REST para acceso a métricas:

**Endpoint 1: GET `/api/metrics`**
- Público (sin autenticación)
- Retorna métricas agregadas compiladas
- Respuesta JSON con estructura estándar

**Endpoint 2: GET `/api/metrics/health`**
- Público (sin autenticación)
- Health check del servicio de métricas
- Retorna: `{ status, recordsStored, timestamp }`

**Endpoint 3: GET `/api/metrics/raw`**
- Requiere JWT en header `Authorization: Bearer <token>`
- Retorna registros sin procesar (útil para debugging)
- Query param: `?limit=100` (máximo 500)

**Endpoint 4: POST `/api/metrics/reset`**
- Requiere JWT en header `Authorization: Bearer <token>`
- Limpia todas las métricas acumuladas
- Reinicia el contador de uptime

---

## 📝 Archivos Modificados

### 1. `server/backend/modules/telemetry/ChatTelemetry.js`
Agregado método `recordTo(aggregator)` y integración automática en `flush()`.

```javascript
// Automático: flush() ahora registra en MetricsAggregatorService
telemetry.flush(); // → se agrega a metricsAggregator automáticamente
```

### 2. `server/backend/server.js`
- Importado: `import metricsRoutes from './routes/metrics.js';`
- Registrada ruta: `app.use('/api/metrics', metricsRoutes);`

---

## 🔄 Flujo de Datos

```
ChatTelemetry.flush()
    ↓
    logger.info() [logs estructurados]
    ↓
    metricsAggregator.recordTelemetry()
    ↓
    [Almacenado en memoria: últimas 1000 llamadas]
    ↓
GET /api/metrics
    ↓
    metricsAggregator.getMetrics() [cálculos en tiempo real]
    ↓
JSON Response
```

---

## 📊 Estructura de Respuesta GET `/api/metrics`

```json
{
  "uptime": 3600000,
  "totalRequests": 245,
  "avgLatencyMs": 342,
  "p95LatencyMs": 890,
  "p99LatencyMs": 1250,
  "errorRate": 2,
  "routes": {
    "l1-greeting": 120,
    "faq-direct": 85,
    "llm": 40
  },
  "avgCacheHitRate": 65,
  "topIntents": {
    "greeting": 45,
    "schedule": 38,
    "experience": 32
  },
  "lastHour": {
    "requests": 180,
    "avgLatencyMs": 315
  },
  "lastMinute": {
    "requests": 12,
    "errors": 0
  }
}
```

---

## 🛡️ Validaciones Implementadas

✅ Edge case: Sin datos → retorna estructura con valores 0  
✅ Protección: División por cero → usa condicionales con length > 0  
✅ NaN/Infinity: Descarta latencias negativas con filtro `totalMs >= 0`  
✅ Errores: Try-catch en recordTelemetry() para evitar crasheos  
✅ Autenticación: JWT requerido para /raw y /reset  

---

## 🚀 Uso desde Cliente

```javascript
// Obtener métricas (sin autenticación)
const response = await fetch('http://localhost:3000/api/metrics');
const metrics = await response.json();
console.log(metrics);

// Obtener registros sin procesar (requiere token)
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/api/metrics/raw?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const records = await response.json();

// Resetear métricas (requiere token)
const response = await fetch('http://localhost:3000/api/metrics/reset', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## ⚙️ Configuración Opcional

Personalizar en `MetricsAggregatorService` constructor:
```javascript
this.maxRecords = 1000; // Cambiar capacidad de almacenamiento
```

---

## 🔍 Testing

### Verificar que se está recolectando datos:
```bash
curl http://localhost:3000/api/metrics
```

### Ver estado del servicio:
```bash
curl http://localhost:3000/api/metrics/health
```

### Resetear métricas (con token):
```bash
curl -X POST http://localhost:3000/api/metrics/reset \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📋 Requisitos Cumplidos

✅ Singleton: Una única instancia de `MetricsAggregatorService`  
✅ Almacenamiento en memoria: Últimas 1000 llamadas o 24h  
✅ Estadísticas en tiempo real: Sin delay en cálculos  
✅ Integración automática: `ChatTelemetry.flush()` registra datos  
✅ Endpoints REST: 4 endpoints con manejo de errores  
✅ Sin bases de datos externas: Solo memoria  
✅ Compatible con logger existente: Mantiene estructura actual  
✅ Marks de telemetry: Se capturan correctamente en `totalMs` y `marks`  
✅ Validación de edge cases: NaN, Infinity, división por cero  
✅ Autenticación JWT: Endpoints sensibles protegidos  

---

## 🔧 Notas de Implementación

- **Performance**: Cálculos en O(n) con n ≤ 1000 registros
- **Memoria**: ~1-2 MB para 1000 registros típicos
- **Thread-safe**: No hay múltiples threads en Node.js, pero puede extenderse
- **Escalabilidad**: Para milestones de datos, considerar Prometheus + TimeSeries DB

---

**Implementación completada**: 4 de mayo de 2026
