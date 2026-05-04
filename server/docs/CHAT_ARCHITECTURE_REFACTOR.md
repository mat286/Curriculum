# Chat Architecture Refactor (Candidate Stream)

## Objetivo
Reforzar `POST /api/chat/candidate/:id/stream` con arquitectura modular, menor latencia y mejor resiliencia sin romper el MVP actual.

## Arquitectura implementada

```text
CandidateChatController
  -> ChatOrchestrator
      -> CandidateAggregateService
      -> ConversationMemoryService
      -> SemanticSearchService
      -> PromptAssembler
      -> ResilientLLMProvider(DefaultLLMProvider)
      -> MultiLevelCacheService
      -> ChatTelemetry
```

## Módulos nuevos

- `modules/chat/ChatOrchestrator.js`
  - Orquesta flujo completo (L1/L2/L3 cache, contexto, LLM, memory, telemetry).
- `modules/chat/StreamResponse.js`
  - Encapsula inicialización y envío SSE.
- `modules/candidate/CandidateAggregateService.js`
  - Consulta agregada en una sola roundtrip con JSON aggregation.
- `modules/candidate/CandidateContextSnapshotService.js`
  - Compila y persiste snapshot de contexto reutilizable.
- `modules/semantic/SemanticSearchService.js`
  - Cache de embeddings de pregunta, timeout elegante, fallback y circuit breaker.
- `modules/memory/ConversationMemoryService.js`
  - Memoria conversacional corta, resumen incremental y persistencia.
- `modules/cache/MultiLevelCacheService.js`
  - L1 greetings, L2 semántico, L3 respuesta final.
- `modules/prompt/PromptAssembler.js`
  - Ensamblado modular del prompt con profile + memory + semantic context.
- `modules/llm/*`
  - Interface de proveedor y wrapper resiliente.
- `modules/telemetry/ChatTelemetry.js`
  - Métricas de latencia por etapas.

## Cambios de persistencia

### Nuevas tablas
- `candidate_context_snapshot`
  - `user_id`, `snapshot_json`, `compiled_context`, timestamps.
- `candidate_conversation_memory`
  - `session_key`, `candidate_id`, `requester_id`, `summary`, `last_messages`.

Se crean en:
- `server/db/init.sql`
- `server/backend/config/db.js` (`ensureProfileSchema`)

## Flujo de request actual

1. Controller valida input y delega al orchestrator.
2. Aggregate carga candidato público + snapshot en una sola consulta.
3. L1: saludo rápido.
4. L3: respuesta final cacheada por `candidateId + question`.
5. Memory: carga conversación corta por sesión.
6. Semantic: embedding cacheado + query Chroma con timeout.
7. PromptAssembler construye prompt final compacto.
8. ResilientLLMProvider invoca proveedor IA con retry + circuit breaker.
9. Streaming SSE token a token al cliente.
10. Se persisten memory y cache final.
11. Telemetry registra tiempos por etapa.

## Compatibilidad

- Endpoints se mantienen:
  - `POST /api/chat/candidate/:id`
  - `POST /api/chat/candidate/:id/stream`
- Formato SSE no cambia (`data: { token }`, `data: { done: true }`).

## Operación

- El snapshot se actualiza automáticamente al guardar perfil (`userController.updateProfile`).
- Si no existe snapshot para un candidato, el orchestrator lo genera en caliente y lo persiste.

## Riesgos y próximos pasos

- El aggregate usa subconsultas JSON para evitar roundtrips; para datasets muy grandes conviene paginar bloques (experiencia/proyectos).
- Para producción de alto tráfico, mover L2/L3 cache y memory a Redis.
- Añadir métricas exportables (Prometheus/OpenTelemetry) sobre `ChatTelemetry`.
