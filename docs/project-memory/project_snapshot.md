# Project Snapshot — CV Conversacional IA
> Actualizado: Sprint 2 P2-003 completado — Mayo 2026

## Estado Actual
**FASE: P0 ✅ + P1 completo ✅ + Sprint 1 ✅ + Sprint 2 ✅ — Sprint 3 siguiente**

## Stack vigente
- Frontend: React 19 + Vite + Router 7 + CSS custom properties
- Backend: Node.js ESM + Express 4 + mysql2 (modular)
- IA: Gemini (primario) → Ollama (fallback + embeddings)
- Retrieval: ChromaDB + BM25 hybrid + ReRanking
- Auth: JWT access 15m + refresh 7d con rotación + RBAC por role
- Transporte: SSE v2 streaming

## Completado en Sprint 2 (P2-003 Multi-rol)
- ✅ DB: campo `role ENUM('candidate','recruiter')` en tabla `usuarios` + índice
- ✅ JWT: claim `role` incluido en access token
- ✅ Middleware: `requireRole(...roles)` composable — 403 si rol no autorizado
- ✅ `/api/recruiter/chat` protegida solo para recruiters
- ✅ `PATCH /api/user/:id/role` para self-service de upgrade
- ✅ AuthContext: expone `role`, `isRecruiter`, `updateRole()`
- ✅ RoleRoute: componente AccesoRestringido con upgrade 1-click para candidatos
- ✅ Navbar: link "Buscar candidatos" condicionado a `isRecruiter` + badge de rol
- ✅ RecruiterPage: maneja 403 gracefully

## Completado en Sprint 1
- ✅ P2-001: ttfbMs/totalMs/ttftMs instrumentados en chatController.askStream
- ✅ P2-001: TTFT E2E separado de TTFB en MetricsAggregatorService
- ✅ S-002: GET /api/metrics protegido con autenticarUsuario

## Próximo objetivo (Sprint 3)
- P2-004: Onboarding wizard guiado — wizard de carga de CV en pasos
- S-003: Content-Security-Policy header personalizado (Helmet)
- S-004: Rate limiting por userId para usuarios autenticados

## Estado Actual
**FASE: P0 ✅ + P1 (P1-002/003/004/005/006 ✅) — P1-001 Observabilidad E2E parcial + P2 Limpieza completada**

## Stack vigente
- Frontend: React 19 + Vite + Router 7 (CSS custom properties — TailwindCSS removido)
- Backend: Node.js ESM + Express 4 + mysql2 (modular: modules/, services/, ai/)
- IA: Gemini (primario) → Ollama (fallback automático + embeddings nomic-embed-text)
- Retrieval: ChromaDB + BM25 hybrid + ReRanking (upgraded desde fixed top-k=2)
- Auth: JWT access 15m + refresh 7d con rotación
- Transporte: SSE v2 streaming con heartbeat + correlación + métricas

## Limpieza técnica aplicada (Mayo 2026)
- ✅ Código muerto eliminado: routerService.js + router.prompt.js (nunca usados en producción)
- ✅ Funciones legacy Ollama eliminadas: generateResponse/generateResponseStream en responseService.js
- ✅ response.prompt.js eliminado (dependía de las funciones legacy)
- ✅ LocalLLMProvider.js + OpenAIProvider.js eliminados (stubs vacíos)
- ✅ isRetryableError centralizado en utils/retryUtils.js (era triplicada)
- ✅ Imports no usados removidos en chatController.js
- ✅ toText/toBoolean/normalizeItems deduplicados → frontend/src/utils/profileNormalizers.js
- ✅ pino-pretty movido a devDependencies en backend
- ✅ tailwindcss + postcss + autoprefixer eliminados de frontend (no estaban configurados)
- ✅ 14 .md obsoletos identificados para eliminar
- ✅ project_context.md actualizado: stack correcto (TailwindCSS eliminado, JWT hardening)

## Bloqueos activos
- Pendiente cierre de observabilidad E2E (P1-001): 2 gaps HIGH
  - chatController.askStream no propaga ttfbMs/totalMs en sendMetrics
  - TTFT E2E y TTFB son alias del mismo dato en MetricsAggregatorService

## Próximo objetivo (P2)
Cerrar P1-001 + arrancar P2:
1. Instrumentar chatController.js askStream con ttfbMs/totalMs reales
2. Separar TTFT E2E de TTFB en MetricsAggregatorService.getChatMetricsSnapshot()
3. Ejecutar limpieza física de archivos obsoletos (ver active_tasks)
4. Refactor system instruction (docs/REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md)