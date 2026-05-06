# PLAN MAESTRO — CV Conversacional IA
> Actualizado: 5 Mayo 2026 — Orquestación Principal

## 🎯 Resumen Ejecutivo

**Proyecto**: CV Conversacional IA (Plataforma de entrevistas virtuales con RAG + LLM)

**Estado Actual**:
- ✅ P0 completado (compresión de contexto, top-k dinámico, RAG híbrido, TTFT frontend)
- ✅ SSE v2 estable (heartbeat, eventos enriquecidos, correlación)
- ✅ Gemini-only estable (Ollama removido por timeout de 60s)
- ✅ Capa DB optimizada para embeddings (metadata durable + cola de indexación + telemetría)
- 🟡 P1 en curso: observabilidad E2E y auditoría QA/Security

**Objetivo Inmediato**:
- TTFT p95 < 1.5s (medición real en P1)
- Latencia total p95 < 6s
- Calidad factual grounded > 90%
- Reindexación/lectura de embeddings más rápida y trazable

**Roadmap Ejecutivo**:
1. **P0 (Done)**: Compresión + top-k dinámico + UX TTFT + RAG híbrido
2. **P1 (Activo)**: Observabilidad E2E + Security audit + regression
3. **P2**: JWT refresh hardening + mejoras UX secundarias

---

## Stack Validado

### Backend
- **Runtime**: Node.js 22 (ESM)
- **Framework**: Express 4.21
- **Database**: MySQL 8 (Docker) + mysql2
- **Auth**: Google OAuth 2.0 + JWT (7d expiry)
- **Streaming**: SSE v2 with StreamResponse.js ✅
  - Events: ack, status, token, metrics, error, heartbeat, done
  - RequestId correlation for traceability
  - Heartbeat every 15s for keep-alive
  - Client disconnect detection
- **Security**:
  - ✅ 4-tier rate limiting (global/chat/auth/faq)
  - ✅ helmet middleware
  - ✅ 404 sanitization
- **Observabilidad**: pino logger, ChatTelemetry service

### Frontend
- **Framework**: React 19 + Vite 5 + React Router 7
- **Styling**: TailwindCSS 4 + design token CSS variables
- **HTTP**: axios (custom api.js service)
- **Auth**: @react-oauth/google
- **State**: React hooks (useState, useContext, useRef)
- **Error Handling**: ErrorBoundary + NotFoundPage ✅
- **Streaming**: SSE consumer with token buffering ✅
  - Token buffering (50ms flush)
  - Status indicators (thinking, streaming, finalizing)
  - Incremental render updates

### IA/RAG Layer
- **Primary LLM**: Gemini API (`@google/generative-ai`)
  - ✅ Quota handling (429 detection + cooldown)
  - ✅ Retry logic in ResilientLLMProvider
  - ✅ Stream error handling
  - **Single point**: No fallback (Ollama removed)
- **Vector DB**: ChromaDB v1.9
   - ✅ Metadata e indexación complementaria ahora en MySQL para control operacional
- **RAG**: ChatOrchestrator → CandidateAggregateService → MultiLevelCache → PromptAssembler → Gemini
- **Caching**: L1 (greetings), L2 (semantic), L3 (response)

### Data Layer (NUEVO)
- **MySQL Embedding Registry**:
   - ✅ `embedding_documents`: metadata por chunk, hash, estado, mapping con Chroma
   - ✅ `embedding_index_jobs`: cola durable para reindexación
   - ✅ `embedding_query_telemetry`: métricas para p50/p95 por método
- **Optimización índices**:
   - ✅ Índices compuestos en memoria conversacional y FAQs
   - ✅ Índices por `user_id + created_at` en tablas CV para lectura más rápida

---

## Estado Actual por Módulo

| Módulo | Status | Notas |
|--------|--------|-------|
| Backend Chat Routing | ✅ | `/api/chat/ask` + `/api/chat/ask/stream` |
| SSE v2 Handler | ✅ | StreamResponse.js with full event support |
| Frontend Streaming | ✅ | Consumes SSE, buffers tokens, renders incrementally |
| Rate Limiting | ✅ | 4 limiters with prefixed key generation |
| Database | ✅ | MySQL 8 with indexed schema |
| OAuth + JWT | ✅ | Google SSO + 7d tokens |
| IA Orchestration | ✅ | Compression + top-k dinámico integrados |
| Vector Search | ✅ | Hybrid + re-ranking activo |
| Frontend TTFT | ✅ | Indicadores visibles y métricas de stream |
| Embedding Metadata DB | ✅ | Tablas + repositorio + telemetría |
| Error Boundaries | ✅ | ErrorBoundary + NotFoundPage |
| Testing | ✅ | vitest + 5 core test files |

---

## 🔴 Bottlenecks Actuales

### 1. TTFT (Time-To-First-Token) — Latency Accumulation
**Problem**: 1.5-2.0s before first token visible to user
- Backend decision/routing: ~500ms
- Vector search + retrieval: ~600-800ms  
- Gemini cold start: ~400-600ms

**Root cause**: No context prefetching, no warmup, sequential operations

**Impact**: Perceived slow UX (spinning indicator > 1.5s)

**Solution P0-002**: Frontend TTFT indicators + skeleton loaders

---

### 2. Validación productiva de mejoras P0
**Problem**: mejoras implementadas, falta observabilidad operacional consolidada

**Root cause**: aún no existe tablero y endpoint operativo final para SLO

**Impact**: riesgo de no detectar degradaciones p95 en tiempo real

**Solution P1-001**: endpoint de métricas + dashboard E2E

---

### 3. QA/Security hardening pre-release
**Problem**: falta auditoría integral sobre los cambios P0 + DB embeddings

**Impact**: posible deuda de seguridad/calidad antes de producción

**Solution P1-002**: auditoría OWASP + suite de regresión E2E

---

### 4. Single Point of Failure — No Fallback
**Problem**: Ollama removed, Gemini is now single path
- If quota hit (429): cooldown → retry chain
- If network down: timeout → error

**Root cause**: Ollama timeout (60s) was worse than no fallback

**Impact**: API outages directly affect users (no circuit breaker)

**Mitigation**: Gemini retry + cooldown logic already handles quota gracefully

---

## ✅ P0 Tasks (Completadas)

### TASK-P0-001: Context Compression + Dynamic Top-K
**Agente**: IA Software Engineer Agent

**Objetivo**: Reducir bloat de contexto antes de enviar a Gemini.

**Tareas específicas**:
1. **ContextCompressionService** (NEW):
   - Detectar redundancia entre CV y embeddings
   - Sumarizar CV por relevancia a pregunta
   - Limitar history a últimas 3 exchanges

2. **DynamicTopKSelector** (NEW):
   - Evaluar "confidence" de embeddings
   - Confidence > 90% → top-k=2
   - Confidence 70-90% → top-k=3
   - Confidence < 70% → top-k=4 o disable RAG

3. **Integración** (MODIFY PromptAssembler):
   - Comprimir contexto ANTES de Gemini
   - Log compression_ratio y reduction_pct

**Estado**: ✅ Completada

**Archivos**:
- NEW: `server/backend/services/ContextCompressionService.js`
- NEW: `server/backend/services/DynamicTopKSelector.js`
- MODIFY: `server/backend/services/PromptAssembler.js`
- MODIFY: `server/backend/modules/chat/ChatOrchestrator.js`

**ETA**: 4-6 hours

---

### TASK-P0-002: Frontend TTFT Indicators + Skeleton States
**Agente**: Frontend Architect Agent

**Objetivo**: Exponer TTFT percibido y mejorar UX de espera.

**Tareas específicas**:
1. **useStreamMetrics hook** (NEW):
   - Capturar `ts` de ACK (request sent)
   - Capturar `ts` de primer STATUS (thinking started)
   - Capturar `ts` de primer TOKEN (TTFT)
   - Exponer: `{ ttft, thinkingMs, streamingActive }`

2. **Indicadores visuales** (MODIFY CandidateChatPage):
   - "Pensando..." durante thinking status
   - Show TTFT cuando llega primer token ("Ready in X.XXs")
   - Smooth transition skeleton → content

3. **Mejorar skeleton** (COMPLETE):
   - CandidateChatPage loadingProfile state: render spinner
   - Status "thinking": pulsating dots
   - Status "streaming": incremental content

4. **Abort/Retry** (MODIFY api.js):
   - AbortController para cancelar stream
   - Botón "Retry" en error
   - Exponential backoff (1s, 2s, 4s)

**Estado**: ✅ Completada

**Archivos**:
- NEW: `frontend/src/hooks/useStreamMetrics.js`
- MODIFY: `frontend/src/pages/CandidateChatPage.jsx`
- NEW: `frontend/src/components/StreamingIndicator.jsx`
- MODIFY: `frontend/src/services/api.js`

**ETA**: 3-4 hours

---

### TASK-P0-003: RAG Quality — Hybrid Search + Re-ranking
**Agente**: IA Software Engineer Agent

**Objetivo**: Mejorar precisión de embeddings con BM25 + re-ranking.

**Tareas específicas**:
1. **HybridSearchService** (NEW):
   - BM25 search en CV (keyword-based)
   - Semantic search en ChromaDB
   - Merge: semantic 60%, BM25 40%
   - Deduplicate por relevance

2. **ReRankingService** (NEW):
   - Use Gemini embeddings API (lightweight)
   - Re-rank top-5 candidates
   - Score by relevance + context
   - Filter low-relevance

3. **Integración** (MODIFY embeddingService):
   - Replace fixed top-k=2 with hybrid
   - Return { results, scores, method }
   - Log search method

**Estado**: ✅ Completada

---

### TASK-P0-004: Database Embedding Optimization
**Agente**: Database Architect Agent + AI Software Engineer Agent

**Estado**: ✅ Completada

**Entregables**:
- Nuevas tablas: `embedding_documents`, `embedding_index_jobs`, `embedding_query_telemetry`
- Nuevos índices compuestos para lectura rápida en FAQs/memoria/tablas CV
- Nuevo repositorio: `EmbeddingMetadataRepository`
- Integración en `embeddingService` (hash, upsert metadata, telemetría)

**Impacto esperado**:
- Reindexación más trazable
- Menos lecturas full-scan en consultas operativas
- Base lista para dashboard p95/p50

**Archivos**:
- NEW: `server/backend/services/HybridSearchService.js`
- NEW: `server/backend/services/ReRankingService.js`
- MODIFY: `server/backend/services/embeddingService.js`

**ETA**: 4-6 hours

---

## 📊 P1 Tasks (Activo)

### TASK-P1-001: Observabilidad E2E & Dashboard
- **Agente**: Backend + Frontend
- **Estado**: 🔄 En curso
- **Scope**: `/api/metrics` endpoint + frontend dashboard
- **Métricas**: TTFT p50/p95, latency histogram, cache ratio, quota status
- **ETA**: 6-8 hours

### TASK-P1-002: Security Audit + Regression Tests P0
- **Agente**: QA + Security Testing Agent
- **Estado**: 🔄 En curso
- **Scope**: OWASP checklist + funcional E2E suite
- **ETA**: 8-10 hours

### TASK-P1-003: JWT Refresh Token Hardening
- **Agente**: Backend Software Engineer Agent
- **Estado**: ⏳ Pendiente
- **Scope**: refresh tokens, rotation, device tracking (optional)
- **ETA**: 3-4 hours

---

## 📈 Métricas a Rastrear

**P0 Targets**:
- TTFT p95: < 1.5s (from ~1.8-2.0s)
- Total latency p95: < 6s
- Context tokens: < 2000 (from ~2800)
- Compression ratio: > 25%
- Factual accuracy: > 90%
- Cache hit ratio L1/L2/L3: > 30%/20%/15%
- Error rate: < 1%
- Retry rate: < 5%

**Frontend UX**:
- TTFT perceived (SSE ack → first token): < 2s
- No layout shifts
- Abort/retry responsiveness: < 500ms

---

## 🔄 Dependencias y Paralelización

```
PARALLELIZABLE P0 (START TODAY):
├─ P0-001: Context compression (IA Agent)
├─ P0-002: TTFT frontend (Frontend Agent)  
└─ P0-003: Hybrid RAG (IA Agent)

THEN P1 (after P0 validated):
├─ P1-001: Observabilidad
├─ P1-002: Security Audit
└─ P1-003: JWT Refresh
```

---

## ✅ Próximos Pasos (NOW)

1. ✅ **Orquestador**: Crear PLAN_MAESTRO.md actualizado
2. 📋 **Orquestador**: Actualizar active_tasks.md
3. 📞 **Orquestador**: Delegar P0-001 a IA Agent
4. 📞 **Orquestador**: Delegar P0-002 a Frontend Agent
5. 📞 **Orquestador**: Delegar P0-003 a IA Agent
6. 🔄 **Orquestador**: Monitorear, validar, actualizar memoria

---

*Generado por CTO Orchestrator — 5 Mayo 2026*
