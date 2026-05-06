# Active Tasks — CV Conversacional IA
> Actualizado: sesión actual — P1 Security + JWT completado

## ✅ P0 COMPLETADO

### TASK-P0-001: Context Compression + Dynamic Top-K
- Agente: AI Software Engineer Agent
- Estado: Completado
- Entregables:
  - ContextCompressionService
  - DynamicTopKSelector
  - Integración en PromptAssembler y orquestación

### TASK-P0-002: Frontend TTFT Indicators + Skeleton States
- Agente: Frontend Architect Agent
- Estado: Completado
- Entregables:
  - useStreamMetrics
  - StreamingIndicator
  - Integración en CandidateChatPage

### TASK-P0-003: Hybrid Search + Re-ranking
- Agente: AI Software Engineer Agent
- Estado: Completado
- Entregables:
  - HybridSearchService
  - ReRankingService
  - Integración en retriever semántico

### TASK-P0-004: Database Optimization for Embeddings
- Agente: Database Architect Agent + AI Software Engineer Agent
- Estado: Completado
- Entregables:
  - Tablas nuevas: embedding_documents, embedding_index_jobs, embedding_query_telemetry
  - Índices compuestos para lecturas rápidas (FAQs, memoria, tablas CV)
  - EmbeddingMetadataRepository
  - Integración en embeddingService (hash, upsert metadata, telemetry)

---

## 🔄 P1 EN CURSO

### TASK-P1-005: CRUD Granular de Perfil por Secciones
- Agente: Backend Software Engineer Agent
- Estado: ✅ Completado
- Prioridad: Alta
- Resultado esperado:
  - Endpoints granulares create/update/delete por seccion de perfil
  - Validacion de sectionKey, payload e itemId
  - Refresh de snapshot + reindex embeddings en background

Subestado actual:
- ✅ Nuevos endpoints en user routes: POST/PUT/DELETE por sectionKey
- ✅ Validaciones por seccion implementadas en userController
- ✅ Compatibilidad preservada con PUT /api/user/:id/data

### TASK-P1-006: UX Perfil + Inspector de Contexto IA
- Agente: Frontend Architect Agent
- Estado: ✅ Completado
- Prioridad: Alta
- Resultado esperado:
  - Inspector visible de contexto IA para auditar calidad de datos
  - Mejora de feedback CRUD en pantalla de perfil
  - Mayor claridad para validar si las respuestas del chat son confiables

Subestado actual:
- ✅ Componente ProfileAIContextInspector integrado en ProfilePage
- ✅ Checklist de faltantes criticos y calidad por seccion
- ✅ Estados de accion CRUD mas claros (agregar/editar/eliminar)

### TASK-P1-004: Reducción TTFT en pipeline de chat
- Agente: Backend Software Engineer Agent
- Estado: En progreso
- Prioridad: Alta
- Resultado esperado:
  - Eliminar pre-routing LLM en camino principal de chat
  - Flujo retrieval-first: getUserData + semanticSearch en paralelo
  - Medición de latencia por etapa para identificar siguiente cuello de botella

Subestado actual:
- ✅ Removido classify() en ask() y askStream() de chatController
- ✅ Eliminado branching needs_db/direct_response del router en camino principal
- 🔄 Siguiente foco: instrumentación por etapa (router, data, semantic, prompt, llm)

### TASK-P1-001: Observabilidad E2E + Metrics Endpoint/Dashboard
- Agente: Backend Software Engineer Agent + Frontend Architect Agent
- Estado: En progreso
- Prioridad: Alta
- Resultado esperado:
  - Endpoint /api/metrics con p50/p95 TTFT/latencia/hits
  - Dashboard básico operativo
  - Correlación por requestId

Subestado actual:
- ✅ Nuevo endpoint interno autenticado: GET /internal/chat/metrics
- ✅ Snapshot interno con latency, ttfb, prompt size, semantic hit ratio y tokens estimados
- ✅ Test de contrato SSE para evento metrics (ttfbMs/totalMs/routed)
- 🔄 Gap HIGH: chatController.askStream aún no propaga ttfbMs/totalMs en sendMetrics
- 🔄 Gap HIGH: ttft y ttfb están modelados como alias en snapshot (falta separar TTFT E2E real)

### TASK-P1-002: QA Security Audit + Regression Suite
- Agente: QA + Security Testing Agent
- Estado: ✅ Completado
- Prioridad: Alta
- Hallazgos resueltos:
  - ALTO: email_verified en authController.js
  - MEDIO: input max 2000 chars en chatController ask() + askStream()
  - MEDIO: trust proxy en server.js para prod
- Tests creados:
  - embeddingService.test.js
  - chatController.integration.test.js
  - hybridIntegration.test.js

### TASK-P1-003: JWT Refresh Token Hardening
- Agente: Backend Software Engineer Agent
- Estado: ✅ Completado
- Prioridad: Media
- Entregables:
  - Tabla refresh_tokens en init.sql
  - Access token 15min + refresh token 7d con hash SHA-256
  - POST /api/auth/refresh con rotación de token
  - Logout revoca refresh tokens activos del usuario

---

## Estado de módulos

| Módulo | Estado |
|---|---|
| Chat streaming SSE v2 | ✅ Completado |
| RAG híbrido + reranking | ✅ Completado |
| Compresión de contexto + top-k dinámico | ✅ Completado |
| Embedding metadata en MySQL | ✅ Completado |
| Cola durable de reindexación | ✅ Completado |
| Telemetría de queries embeddings | ✅ Completado |
| Security audit release-gate (OWASP) | ✅ Completado |
| JWT refresh hardening (15m/7d rotación) | ✅ Completado |
| CRUD granular perfil por secciones | ✅ Completado |
| UX perfil con inspector de contexto IA | ✅ Completado |
| Endpoint interno /internal/chat/metrics | ✅ Completado |
| Dashboard métricas frontend | ✅ Completado |
| Índices DB telemetría embedding | ✅ Completado |
| Limpieza técnica deuda P2 | ✅ Completado |
| Observabilidad E2E TTFT pipeline autenticado | 🔄 En progreso (2 gaps HIGH) |
| Refactor system instruction GeminiProvider | ⏳ Pendiente |
| Autenticación multi-rol (recruiter scopes) | ⏳ Pendiente |
| Tests E2E cypress | ⏳ Pendiente |

---

## TASK-P2-CLEANUP: Limpieza física de archivos obsoletos
> Ejecutar manualmente con el script PowerShell que sigue

### Archivos a ELIMINAR (código backend):
- `server/backend/services/routerService.js` — dead code, nunca importado en prod
- `server/backend/prompts/router.prompt.js` — solo lo usaba routerService.js
- `server/backend/prompts/response.prompt.js` — funciones legacy Ollama eliminadas
- `server/backend/modules/llm/LocalLLMProvider.js` — stub vacío
- `server/backend/modules/llm/OpenAIProvider.js` — stub vacío

### Archivos .md a ELIMINAR:
```powershell
# Ejecutar desde la raíz del proyecto (c:\Users\mfrivera\Desktop\no ver\Entrevista virtual\)
$base = "."
Remove-Item "$base\docs\P0-COMPLETION-REPORT.md" -Force
Remove-Item "$base\docs\P0-002-COMPLETION-REPORT.md" -Force
Remove-Item "$base\docs\P0-SUMMARY.md" -Force
Remove-Item "$base\docs\TELEMETRY_DASHBOARD_IMPLEMENTATION.md" -Force
Remove-Item "$base\docs\CHEATSHEET_SIGNATURE_CHANGES.md" -Force
Remove-Item "$base\docs\QUICK_REFERENCE_SYSTEM_INSTRUCTION.md" -Force
Remove-Item "$base\docs\INDEX_SYSTEM_INSTRUCTION_DESIGN.md" -Force
Remove-Item "$base\docs\INTERFACE_PROPOSAL_SYSTEM_INSTRUCTION.md" -Force
Remove-Item "$base\server\docs\API_Y_FLUJO.md" -Force
Remove-Item "$base\server\docs\COMPONENTES.md" -Force
Remove-Item "$base\server\docs\COSTOS_Y_REQUERIMIENTOS.md" -Force
Remove-Item "$base\frontend\P0-002-IMPLEMENTATION.md" -Force
Remove-Item "$base\frontend\README del back end.md" -Force
```

### Dependencias npm a instalar/actualizar:
```powershell
# Backend: reinstalar para reflejar cambio pino-pretty a devDependencies
cd server/backend && npm install

# Frontend: remover paquetes eliminados
cd ../../frontend && npm install
```

---

## Dependencias actuales

1. P1-001 gaps HIGH pendientes antes de cerrar observabilidad.
2. Limpieza física de archivos (TASK-P2-CLEANUP) puede ejecutarse en cualquier momento.
3. Refactor system instruction depende de P1-001 cerrado (docs/REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md).
4. P2 features (chat grupal, analytics, multi-rol) dependen de P1 completado.
