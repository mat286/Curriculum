# Project Context — CV Conversacional IA

## Proyecto
**Nombre**: CV Conversacional IA (Entrevista Virtual)
**Versión**: 2.0.0

## Visión
Plataforma donde cada profesional tiene un "avatar IA" que representa su perfil de CV y puede responder preguntas en su nombre, en primera persona. Los reclutadores pueden buscar candidatos semánticamente describiendo el perfil que necesitan en lenguaje natural.

## Objetivo
- Candidatos: carguen su CV estructurado y activen su perfil público para ser descubiertos
- Reclutadores: describan un perfil en chat y el sistema devuelva candidatos rankeados por similitud semántica
- Visitantes: interactúen con el avatar de un candidato como si hablaran con él directamente

## Problema que Resuelve
Los CVs estáticos (PDF/web) no permiten interacción. Este sistema convierte el CV en una entidad conversacional, accesible vía chat, con respuestas en primera persona y contexto enriquecido por RAG.

## Usuarios
1. **Candidatos**: crean cuenta via Google, editan su CV, activan perfil público
2. **Reclutadores**: buscan candidatos con lenguaje natural, ven ranking semántico
3. **Visitantes anónimos**: chatean con el avatar de candidatos públicos

## Stack
```
Frontend:  React 19 + Vite 5 + React Router 7 + @react-oauth/google + CSS custom properties
Backend:   Node.js ESM + Express 4 + mysql2 + pino + helmet + express-rate-limit
IA:        @google/generative-ai (Gemini — proveedor principal)
           Ollama (solo fallback automático cuando Gemini falla por cuota/red + embeddings nomic)
Vector DB: ChromaDB v1.9
DB:        MySQL 8 (Docker)
Auth:      JWT access 15m + refresh 7d con rotación (jsonwebtoken) + Google OAuth (google-auth-library)
Infra:     Docker Compose (mysql + ollama + chromadb + backend)
```

## Arquitectura

### Backend Modular
```
controllers/     → Orquestan casos de uso
services/        → Lógica reutilizable (data, routing, response, embedding)
modules/
  cache/         → MultiLevelCacheService (L1 greeetings, L2 semántico, L3 respuesta)
  candidate/     → CandidateAggregateService, CandidateContextSnapshotService
  chat/          → ChatOrchestrator, NormalizeQuestionService, IntentClassifierService
  faq/           → FAQSemanticRetriever
  llm/           → DefaultLLMProvider, ResilientLLMProvider (circuit breaker + retry)
  memory/        → ConversationMemoryService
  prompt/        → PromptAssembler
  semantic/      → TargetedSemanticRetriever
  telemetry/     → ChatTelemetry
ai/              → AIProvider (interface), GeminiProvider, OllamaProvider
prompts/         → router.prompt.js, response.prompt.js, recruiter.prompt.js
middlewares/     → authMiddleware, errorHandler, rateLimiter
config/          → db, ollama, gemini, chroma, validateEnv
```

### Frontend
```
pages/
  Home.jsx             → Landing / lista de candidatos públicos
  ProfilePage.jsx      → Edición de CV (protegida)
  CandidateChatPage.jsx → Chat con avatar + sidebar de CV
  RecruiterPage.jsx    → Búsqueda recruiter
components/
  LoginPage.jsx        → OAuth Google
  Navbar.jsx
  CVModal.jsx
  AvatarCard.jsx
  ProtectedRoute.jsx
  profile/             → ProfileSidebar, ProfileSection, ProfileListSection
context/
  AuthContext.jsx      → JWT, user state
services/
  api.js               → Axios calls al backend
```

## Schema de Base de Datos (MySQL)
Tablas principales:
- `usuarios` — datos base + is_public + links sociales
- `sobre_mi` — descripción personal
- `experiencia_laboral` — historial laboral
- `educacion` — historial educativo
- (más tablas: habilidades, proyectos, certificaciones, idiomas, etc.)
- `candidate_context_snapshot` — snapshot compilado para RAG
- `candidate_conversation_memory` — memoria conversacional por sesión

## Reglas del Proyecto
- Arquitectura modular: responsabilidades separadas
- Sin código duplicado entre servicios
- Prompts versionados en `/prompts/`
- Variables de entorno validadas al arranque
- Rate limiting activo en endpoints de chat
- Logs estructurados (pino) en todos los servicios
- Docker-first para infraestructura local
- Frontend y backend deployables independientemente

## Estado Actual
Ver `project_snapshot.md`

## Riesgos
1. **Dependencia Ollama**: embeddings siempre requieren Ollama corriendo, incluso con Gemini activo
2. **Sin tests**: cualquier refactor puede romper funcionalidad crítica sin detección
3. **ChromaDB persistencia**: si el volumen Docker se pierde, hay que re-indexar todos los embeddings
4. **Rate limit Gemini (429)**: cooldown de 10min, fallback a Ollama, pero Ollama puede ser lento sin GPU
5. **Sin CI/CD**: deploys manuales, propenso a errores

## Restricciones
- Google OAuth requiere dominio registrado en Google Console para producción
- Ollama requiere al menos 8GB RAM (modelo mistral:7b)
- ChromaDB v1.9 — migración a v2 requiere cambios en la API de colecciones

## Agentes del Proyecto
- **Orquestador**: coordinación general
- **Backend Software Engineer Agent**: módulos Node.js, servicios IA, DB
- **Frontend Architect Agent**: UI/UX, componentes React, integración APIs
- **QA + Security Testing Agent**: auditoría, tests, vulnerabilidades

## Roadmap

### Sprint P0 — Latencia y Calidad Conversacional (Activo)
- **Objetivo**: reducir TTFT y latencia total sin degradar precisión factual.
- **Entregables**:
  - SSE v2 con eventos de estado + heartbeat + compatibilidad backward.
  - Top-k dinámico + dedupe + compresión de contexto.
  - UX streaming con buffering, cancelación y reintento.
  - Métricas p50/p95 por etapa y correlación E2E.
- **Dependencias**:
  - Backend SSE contract -> Frontend rendering states.
  - IA retrieval policy -> Backend orchestration + telemetry.

### Sprint P1 — Escalabilidad Operativa
- Redis cache distribuido + invalidación por snapshot.
- Cola de indexación embeddings con DLQ.
- Contrato versionado IA-backend con budgets por bloque.

### Sprint P2 — Calidad Avanzada
- Hybrid search SQL + vector con fusion score.
- Reranking dedicado y memoria jerárquica.
- A/B experiments con criterios de éxito cuantitativos.

## Decisiones

### DEC-2026-05-05-01
- **Contexto**: el foco principal del producto es entrevista conversacional ultra-rápida.
- **Decisión**: priorizar TTFT p95 y latencia total p95 por encima de features secundarias.
- **Impacto**: backlog reordenado a Sprint P0 técnico transversal.

### DEC-2026-05-05-02
- **Contexto**: frontend y backend no comparten contrato SSE enriquecido.
- **Decisión**: estandarizar eventos `ack/status/token/metrics/error/done` con backward compatibility.
- **Impacto**: habilita UX de estados, cancelación, retry y observabilidad E2E.

### DEC-2026-05-05-03
- **Contexto**: prompts y retrieval consumen tokens de forma no adaptativa.
- **Decisión**: introducir top-k dinámico + compresión + dedupe como quick wins P0.
- **Impacto**: menor latencia y costo, mejor grounding bajo budget.
