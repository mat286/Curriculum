# Active Tasks — CV Conversacional IA
> Actualizado: 4 Mayo 2026

## 🔴 PRIORIDAD CRÍTICA

### TASK-001: FAQs CRUD Backend
- **Agente**: Backend Software Engineer Agent
- **Estado**: No iniciado
- **Prioridad**: Alta
- **Dependencia**: Schema FAQ en MySQL (tabla candidate_faqs)
- **Resultado esperado**:
  - Tabla `candidate_faqs` (id, user_id, question, answer, embedding_id)
  - Endpoints: POST/GET/PUT/DELETE `/api/candidates/:id/faq`
  - Indexación automática en ChromaDB al crear/actualizar
  - Validación: solo el propio candidato puede gestionar sus FAQs

### TASK-002: FAQs UI en ProfilePage
- **Agente**: Frontend Architect Agent
- **Estado**: No iniciado
- **Prioridad**: Alta
- **Dependencia**: TASK-001
- **Resultado esperado**:
  - Sección "Preguntas frecuentes" en ProfilePage
  - CRUD visual (agregar, editar, eliminar FAQ)
  - Integración con api.js

### TASK-003: Suite de Tests Unitarios Core
- **Agente**: QA + Security Testing Agent
- **Estado**: No iniciado
- **Prioridad**: Alta (crítico para estabilidad)
- **Dependencia**: Ninguna
- **Resultado esperado**:
  - Tests para: MultiLevelCacheService, NormalizeQuestionService, IntentClassifierService
  - Tests para: GeminiProvider (mock), OllamaProvider (mock)
  - Tests para: routerService, responseService (con LLM mockeado)
  - Framework sugerido: Node.js test runner nativo o Vitest

### TASK-004: Auditoría de Seguridad OWASP
- **Agente**: QA + Security Testing Agent
- **Estado**: No iniciado
- **Prioridad**: Alta (crítico antes de producción)
- **Dependencia**: Ninguna
- **Resultado esperado**:
  - Revisión OWASP Top 10 aplicada al código actual
  - Lista de vulnerabilidades con severidad
  - Pull-list de fixes con prioridad

---

## 🟡 PRIORIDAD MEDIA

### TASK-005: Refresh Token / JWT Expiry
- **Agente**: Backend Software Engineer Agent
- **Estado**: No iniciado
- **Prioridad**: Media
- **Dependencia**: TASK-004 (validar que el fix sea parte del hardening)
- **Resultado esperado**:
  - JWT con expiración (actualmente revisar si hay exp configurado)
  - Refresh token endpoint o re-login flow

### TASK-006: Skeleton Loaders + Error States Frontend
- **Agente**: Frontend Architect Agent
- **Estado**: No iniciado
- **Prioridad**: Media
- **Dependencia**: Ninguna
- **Resultado esperado**:
  - Skeleton loaders en CandidateChatPage mientras carga el perfil
  - Error boundary global
  - Página 404 dedicada

### TASK-007: Rate Limit por Endpoint
- **Agente**: Backend Software Engineer Agent
- **Estado**: No iniciado
- **Prioridad**: Media
- **Dependencia**: TASK-004
- **Resultado esperado**:
  - Rate limiter diferenciado: /api/chat más restrictivo que /api/user
  - Rate limiter por IP + por usuario autenticado

### TASK-008: CI/CD GitHub Actions Básico ✅ COMPLETADO
- **Agente**: Backend Software Engineer Agent
- **Estado**: Completado
- **Prioridad**: Media
- **Dependencia**: TASK-003 (necesita tests para correr en CI)
- **Resultado esperado**:
  - ✅ Workflow: lint + tests en cada PR/push (.github/workflows/test.yml)
  - ✅ Workflow: build Docker en merge a main (.github/workflows/docker.yml)

---

## 🟢 PRIORIDAD BAJA / FUTURO

### TASK-009: Dashboard Telemetría ✅ COMPLETADO
- **Agente**: Backend Software Engineer Agent
- **Estado**: Completado
- **Prioridad**: Baja
- **Resultado esperado**:
  - ✅ MetricsAggregatorService (módulo telemetría)
  - ✅ Integración automática en ChatTelemetry.flush()
  - ✅ 4 Endpoints REST: GET /api/metrics, /health, /raw, POST /reset
  - ✅ Almacenamiento en memoria (últimas 1000 llamadas)
  - ✅ Cálculos en tiempo real: avg, p95, p99, errorRate, routes, topIntents
  - ✅ Documentación en docs/TELEMETRY_DASHBOARD_IMPLEMENTATION.md

### TASK-010: Sistema de Favoritos Recruiter
- **Agente**: Backend + Frontend
- **Estado**: No iniciado
- **Prioridad**: Baja

### TASK-011: Notificaciones Candidato
- **Agente**: Backend + Frontend
- **Estado**: No iniciado
- **Prioridad**: Baja

### TASK-012: Onboarding Wizard para Candidatos Nuevos
-### TASK-012: Onboarding Wizard para Candidatos Nuevos ✅ COMPLETADO
- **Agente**: Frontend Architect Agent
- **Estado**: Completado
- **Prioridad**: Baja (completado como último task de Sprint 3)
- **Resultado esperado**:
  - ✅ Wizard de 5 pasos (bienvenida, foto, datos, CV, perfil público)
  - ✅ Progreso persistido en localStorage + backend
  - ✅ Validaciones (foto 5MB, nombre 2-100 chars, etc)
  - ✅ Integración con AuthContext + ProtectedRoute
  - ✅ Ruta protegida /onboarding
  - ✅ Servicios API (photo upload, step save, complete)
  - ✅ Responsive mobile-first + animaciones
