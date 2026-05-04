# Plan Maestro: Verificación, Mejoras y Completion del Proyecto
> CV Conversacional IA — 4 Mayo 2026

---

## 1. ANÁLISIS DEL PROYECTO

### ¿Qué es?
Un sistema de **CV conversacional** donde:
- Candidatos crean perfiles con sus CVs estructurados
- Cada candidato tiene un "avatar IA" que responde preguntas sobre su perfil
- Reclutadores buscan candidatos semánticamente mediante lenguaje natural

### Estado Real del Proyecto
El proyecto está **más avanzado de lo que parece** desde fuera. Tiene:
- ✅ Arquitectura modular de producción (orquestador, cache, telemetría, circuit breaker)
- ✅ RAG funcional con ChromaDB + Ollama embeddings
- ✅ SSE streaming de respuestas
- ✅ Fallback Gemini → Ollama automático
- ✅ Recruiter search con ranking semántico por LLM
- ✅ Frontend React completo con OAuth

**El problema principal**: falta el "último 20%" que hace que un proyecto pase de "funciona en dev" a "listo para producción real".

---

## 2. VERIFICACIÓN DE FUNCIONALIDADES

### ✅ Funcionalidades Verificadas como Implementadas

#### Auth
- Login con Google OAuth → JWT generado en backend
- `ProtectedRoute` en frontend bloquea rutas privadas
- `authMiddleware.js` valida JWT en endpoints protegidos
- `validateEnv.js` valida variables críticas al arranque

#### Perfil / CV
- `GET/PUT /api/user/:id/data` — lectura y actualización completa
- Schema MySQL completo: usuarios, sobre_mi, experiencia_laboral, educacion + otras tablas
- Frontend `ProfilePage.jsx` con edición secciones múltiples

#### Chat con Avatar (Candidato)
- `POST /api/chat/candidate/:id` — chat JSON estándar
- `POST /api/chat/candidate/:id/stream` — SSE streaming token a token
- Router inteligente de intents (classifica si needs_db)
- Cache L1 (saludos) → L2 (semántico) → L3 (respuesta final)
- Snapshot compilado del candidato (una sola roundtrip a DB)
- Memoria conversacional incremental
- FAQSemanticRetriever integrado en el orquestador

#### Recruiter
- `POST /api/recruiter/chat` — fases: collect → search → rank
- Búsqueda semántica en colección global ChromaDB
- Ranking por LLM con score + reason por candidato
- Frontend `RecruiterPage.jsx` con chat + cards de resultados

#### Infraestructura
- Docker Compose: MySQL + Ollama + ChromaDB + Backend
- Health check `/health` verifica los 3 servicios
- Rate limiting (express-rate-limit)
- Logs estructurados (pino)
- CORS configurado con allowedOrigins

---

### ⚠️ Funcionalidades Parcialmente Implementadas

#### FAQs por Candidato
- **Estado**: módulo `FAQSemanticRetriever` creado e integrado en el orquestador
- **Falta**: tabla MySQL `candidate_faqs`, endpoints CRUD, UI de gestión
- **Impacto**: sin FAQs cargadas, el retriever siempre retorna vacío (no rompe pero tampoco aporta)

#### Snapshot Invalidation
- **Estado**: `CandidateContextSnapshotService` crea snapshot al primer chat
- **Falta**: trigger de invalidación cuando el candidato actualiza su CV (PUT /api/user/:id/data debería invalidar el snapshot)
- **Impacto**: si el candidato actualiza su CV, el avatar podría responder con datos viejos hasta que el snapshot expire/se regenere

#### Indexación de Embeddings
- **Estado**: `scripts/indexEmbeddings.js` funciona manualmente
- **Falta**: trigger automático al actualizar perfil (especialmente al activar `is_public`)
- **Impacto**: un candidato que activa su perfil no aparece en búsquedas de recruiter hasta re-indexar manualmente

---

### ❌ Funcionalidades Ausentes (no implementadas)

1. **Tests** — ningún archivo de test en todo el proyecto
2. **Refresh token** — JWT sin mecanismo de renovación
3. **Invalidación de snapshot automática** — al actualizar CV
4. **Auto-indexación en ChromaDB** — al activar perfil público
5. **Panel de FAQs en frontend** — UI para que candidatos gestionen FAQs
6. **Error boundaries React** — si falla un componente, rompe todo
7. **Página 404** — ruta catch-all no encontrada
8. **Mobile responsive** — no verificado (CSS existe pero sin auditoría)
9. **Open Graph tags** — compartir URL del avatar en redes sociales
10. **CI/CD** — pipeline de integración continua

---

## 3. RIESGOS IDENTIFICADOS

| Riesgo | Severidad | Impacto |
|--------|-----------|---------|
| Sin tests | 🔴 Alta | Cualquier cambio puede romper chat/auth sin detección |
| Snapshot obsoleto al editar CV | 🔴 Alta | Avatar responde con datos desactualizados |
| Embeddings no auto-indexados | 🔴 Alta | Candidatos no aparecen en búsqueda recruiter |
| JWT sin refresh/expiración corta | 🟡 Media | Tokens viven indefinidamente si no hay exp corta |
| ChromaDB sin backup | 🟡 Media | Pérdida de todos los embeddings si el volumen Docker se borra |
| Rate limit global (no por endpoint) | 🟡 Media | Chat más caro en compute tiene mismo límite que profile |
| Sin error boundaries React | 🟡 Media | Un error JS rompe toda la app |
| Ollama requerido incluso con Gemini | 🟡 Media | Si Ollama está caído, embeddings fallan aunque Gemini funcione |

---

## 4. ROADMAP PRIORIZADO — PRÓXIMOS PASOS

### Sprint 1 (INMEDIATO — 1–2 semanas) 🔴
**Objetivo**: Cerrar gaps críticos de funcionalidad

#### Backend
1. **Invalidar snapshot al editar CV** — agregar llamada a `snapshotService.invalidate(userId)` en `userController.js` después del PUT
2. **Auto-indexar embeddings al activar `is_public`** — en `userController.js` al detectar cambio de `is_public: 0 → 1`, triggear `indexEmbeddings` para ese usuario
3. **FAQs CRUD backend** — tabla `candidate_faqs` + endpoints `/api/candidates/:id/faq`

#### Frontend
4. **Error boundary global** — `<ErrorBoundary>` en `App.jsx`
5. **Página 404** — ruta catch-all en Routes

---

### Sprint 2 (CORTO PLAZO — 2–4 semanas) 🟡
**Objetivo**: Calidad y confianza

6. **FAQs UI** en ProfilePage (depende de Sprint 1 #3)
7. **Tests unitarios** — al menos: cache, normalizer, intent classifier, providers (mockeados)
8. **Auditoría seguridad OWASP** — especialmente: input sanitization, SQL injection review, JWT expiry
9. **Rate limit por endpoint** — más restrictivo en /api/chat

---

### Sprint 3 (MEDIANO PLAZO — 1 mes) 🟢
**Objetivo**: UX profesional y observabilidad

10. **Skeleton loaders** en CandidateChatPage
11. **Dashboard básico de telemetría** — métricas de uso
12. **Onboarding wizard** para candidatos nuevos
13. **CI/CD básico** (GitHub Actions)
14. **Refresh token** o sesión con expiración

---

### Sprint 4+ (LARGO PLAZO) ⚫
- Features sociales (favoritos, notificaciones)
- Deploy production con CDN + monitoring
- Escalado Ollama (GPU separada)

---

## 5. AGENTES Y ASIGNACIONES

| Sprint | Tarea | Agente |
|--------|-------|--------|
| 1 | Snapshot invalidation + auto-index | Backend Software Engineer Agent |
| 1 | FAQs CRUD backend | Backend Software Engineer Agent |
| 1 | Error boundary + 404 | Frontend Architect Agent |
| 2 | FAQs UI | Frontend Architect Agent |
| 2 | Tests + Auditoría seguridad | QA + Security Testing Agent |
| 2 | Rate limit por endpoint | Backend Software Engineer Agent |
| 3 | Skeleton loaders + UX | Frontend Architect Agent |
| 3 | Telemetría dashboard | Backend + Frontend |
| 3 | CI/CD | Backend Software Engineer Agent |

---

## 6. CRITERIOS DE "LISTO PARA PRODUCCIÓN"

El proyecto se considera production-ready cuando:
- [ ] Todos los Sprint 1 y Sprint 2 completados
- [ ] Cobertura de tests ≥ 60% en módulos críticos
- [ ] Auditoría OWASP sin issues de severidad Alta
- [ ] Snapshot se invalida automáticamente al editar CV
- [ ] Candidatos aparecen en búsqueda recruiter al activar perfil (sin acción manual)
- [ ] JWT con expiración configurada
- [ ] Error boundary en frontend
- [ ] CI/CD corriendo tests en PRs
- [ ] `.env.example` actualizado con todas las variables
