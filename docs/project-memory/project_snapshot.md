# Project Snapshot — CV Conversacional IA
> Actualizado: 4 Mayo 2026

## Estado Actual
**FASE: Sprint 3 — DevOps + Observabilidad**

El proyecto es un sistema de **CV conversacional con IA** que permite a candidatos exponer su perfil profesional como un avatar interactivo, y a reclutadores buscar candidatos por perfil semántico.

✅ **Sprint 1-2 Completados**: Frontend gaps, FAQs UI, Rate limiting, Tests 60+ casos, OWASP fixes
**FASE: Sprint 3 — Observabilidad + UX (99% completado)**

✅ **Sprint 3 Completado**: CI/CD GitHub Actions + Dashboard Telemetría en tiempo real
⏳ **Sprint 3 Final**: Onboarding wizard para candidatos nuevos (TASK-012)
## Stack
- **Frontend**: React 19 + Vite + React Router 7 + Tailwind CSS 4 + Google OAuth
- **Backend**: Node.js (ESM) + Express 4 + Helmet + Rate Limiter
- **DB**: MySQL 8 (pool de conexiones via mysql2)
- **IA**: Gemini (primario) + Ollama (fallback + embeddings siempre)
- **Vector DB**: ChromaDB (RAG semántico)
- **Auth**: JWT + Google OAuth (google-auth-library)
- **Logs**: Pino

## Arquitectura Actual

```
Frontend (React)
  └─ /login          → Google OAuth
  └─ /perfil         → Edición de CV (ProtectedRoute)
  └─ /:id            → Avatar chat público (candidato)
  └─ /search         → Búsqueda recruiter (ProtectedRoute)

Backend (Express)
  └─ POST /api/user/google       → Auth
  └─ GET/PUT /api/user/:id       → Perfil
  └─ POST /api/chat/ask          → Chat básico
  └─ POST /api/chat/candidate/:id       → Chat candidato (JSON)
  └─ POST /api/chat/candidate/:id/stream → Chat candidato (SSE)
  └─ POST /api/recruiter/chat    → Búsqueda recruiter
  └─ GET /api/metrics            → Métricas agregadas (telemetría)
  └─ GET /api/metrics/health     → Health check telemetría
  └─ GET /api/metrics/raw        → Registros sin procesar (admin)
  └─ POST /api/metrics/reset     → Reset de métricas (admin)
  └─ GET /health                 → Health checks servicios

Módulos avanzados (server/backend/modules/):
  ChatOrchestrator → CandidateAggregateService → MultiLevelCacheService
  → PromptAssembler → ResilientLLMProvider → ChatTelemetry
  → ConversationMemoryService → FAQSemanticRetriever
```

## Fase del Roadmap
- ✅ Auth con Google
- ✅ Perfil editable (CV estructurado)
- ✅ Chat con avatar (SSE streaming)
- ✅ Router inteligente de intents
- ✅ RAG semántico (ChromaDB + embeddings)
- ✅ Caché multinivel (L1/L2/L3)
- ✅ Recruiter chat + búsqueda semántica
- ✅ Arquitectura modular (orquestador, snapshot, memory)
- ✅ Dashboard telemetría (MetricsAggregatorService + endpoints REST)
- ⚠️ FAQs por candidato (módulo creado, integración parcial)
- ⚠️ Tests (ausentes)
- ⚠️ CI/CD (no configurado)
- ❌ Panel de analytics visual (frontend dashboard)
- ❌ Notificaciones (reclutador → candidato)
- ❌ Sistema de favoritos / guardado de búsquedas recruiter
- ❌ Panel admin

## Bloqueos Activos
- Sin archivo `.env.example` en frontend
- Sin tests unitarios ni de integración
- Sin CI/CD pipeline
- ChromaDB necesita Ollama siempre corriendo para embeddings (incluso cuando AI_PROVIDER=gemini)

## Próximo Objetivo
Completar FAQs por candidato + suite de tests básica + hardening seguridad/producción
