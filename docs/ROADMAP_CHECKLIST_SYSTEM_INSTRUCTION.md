# Refactor System Instructions — Roadmap & Checklist

**Resumen ejecutivo para orquestación Backend AI Agent + Backend Engineer**

---

## 1. VISIÓN GENERAL

### Objetivo principal
Separar **instrucciones del sistema** (comportamiento del modelo) de **contexto del usuario** (información necesaria para responder) en GeminiProvider y PromptAssembler, aprovechando `systemInstruction` nativa de Gemini API v1.5+.

### Beneficios esperados
| Beneficio | Impacto |
|-----------|---------|
| Mejor control semántico | Gemini entiende qué es "instrucción" vs "contexto" |
| Eficiencia de tokens | Posible optimización en cost de API (system instructions más eficientes) |
| Auditoría clara | Logs separan qué fue instrucción de qué fue data |
| Compatibilidad | Cambios son backwards-compatible (ChatController sin cambios) |
| Escalabilidad RAG | Base sólida para mejorar RAG sin refactor adicional |

---

## 2. SCOPE DEL REFACTOR

### Archivos que cambian

```
✅ server/backend/ai/GeminiProvider.js           (MUST CHANGE)
✅ server/backend/modules/prompt/PromptAssembler.js  (MUST CHANGE)
✅ server/backend/ai/index.js                  (MUST CHANGE - factory wrapper)
⚠️  server/backend/services/responseService.js  (OPTIONAL - compatible)
❌ server/backend/controllers/chatController.js (ZERO CHANGES)
```

### Líneas de código aproximadas

| Archivo | Current | Modified | Delta |
|---------|---------|----------|-------|
| GeminiProvider | ~230 | ~240 | +10 |
| PromptAssembler | ~100 | ~120 | +20 |
| ai/index.js | ~120 | ~160 | +40 |
| ResponseService | ~45 | ~65 | +20 |
| **Total** | **~495** | **~585** | **+90** |

**Cambio pequeño, impacto controlado.**

---

## 3. FASES DE IMPLEMENTACIÓN

### FASE 1: Backend AI Agent (12-24 horas)

**Responsable:** AI Agent especializado en prompts  
**Output:** Prompt de sistema definitivo para Gemini

**Tareas:**

- [ ] Redactar system prompt comprensivo (250-400 caracteres)
- [ ] Incluir: rol, restricciones, formato, tono
- [ ] Validar que es independiente de userPrompt
- [ ] Documentar ejemplos de qué debería retornar el modelo
- [ ] Proponer ajustes a la distribución (qué va dónde) si es necesario
- [ ] Crear documento: `SYSTEM_PROMPT_DEFINITION.md` con:
  - Versión final del prompt
  - Justificación de cada línea
  - Ejemplos expected behavior
  - Edge cases cubiertos

**Entrada requerida:**
- Este documento (REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md)
- INTERFACE_PROPOSAL_SYSTEM_INSTRUCTION.md

**Entrega:**
```
docs/SYSTEM_PROMPT_DEFINITION.md
```

---

### FASE 2: Backend Engineer (24-48 horas)

**Responsable:** Senior Backend Engineer  
**Input:** SYSTEM_PROMPT_DEFINITION.md + documentos de diseño  
**Output:** Código implementado + tests

#### Subtarea 2.1: PromptAssembler.build()
- [ ] Modificar retorno para retornar 3 fields:
  - `systemInstruction: string`
  - `userPrompt: string`
  - `compressionStats: object`
- [ ] Implementar lógica de separación (qué va dónde)
- [ ] Agregar validaciones
- [ ] Agregar logging
- [ ] Unit tests: validar 3 fields
- [ ] Commit: `feat: PromptAssembler separates systemInstruction`

#### Subtask 2.2: GeminiProvider.generate()
- [ ] Actualizar firma: `generate(userPrompt, options, systemInstruction)`
- [ ] Implementar: si systemInstruction existe, pasar a modelConfig
- [ ] Agregar logging
- [ ] Fallback: si systemInstruction no pasado, comportamiento actual
- [ ] Unit tests: validar que systemInstruction llega a modelConfig
- [ ] Unit tests: validar fallback (sin systemInstruction)
- [ ] Commit: `feat: GeminiProvider.generate supports systemInstruction`

#### Subtask 2.3: GeminiProvider.generateStream()
- [ ] Actualizar firma: `generateStream(userPrompt, options, onChunk, systemInstruction)`
- [ ] Implementar: mismo logic que generate()
- [ ] Agregar logging
- [ ] Unit tests: validar systemInstruction en streaming
- [ ] Commit: `feat: GeminiProvider.generateStream supports systemInstruction`

#### Subtask 2.4: ai/index.js (factory)
- [ ] Actualizar wrapper para pasar systemInstruction
- [ ] Implementar fallback: si Gemini en cooldown, concatenar systemInstruction + userPrompt
- [ ] Agregar logging
- [ ] Validar ambos métodos: generate() y generateStream()
- [ ] Unit tests: fallback logic
- [ ] Commit: `feat: ai/index.js factory wrapper supports systemInstruction fallback`

#### Subtask 2.5: ResponseService (OPCIONAL)
- [ ] Actualizar firmas para pasar systemInstruction
- [ ] Backwards-compatible: parámetro optional
- [ ] Unit tests
- [ ] Commit: `feat: ResponseService supports systemInstruction parameter`

#### Subtask 2.6: Testing
- [ ] Unit tests para cada método (4 archivos)
- [ ] Integration tests: ask() flujo completo (sin cambios a ChatController)
- [ ] Integration tests: askStream() flujo completo
- [ ] Regression tests: verificar que código viejo sigue funcionando
- [ ] Test file: `tests/systemInstruction.integration.test.js`
- [ ] Commit: `test: comprehensive system instruction tests`

#### Subtask 2.7: Documentation
- [ ] Actualizar README.md si es necesario
- [ ] JSDoc en funciones afectadas
- [ ] Commit: `docs: system instruction refactor documentation`

**Checklist de validación:**
- [ ] `npm test` pasa sin errores
- [ ] `get_errors` sin errors
- [ ] Flujo ask/askStream operativo
- [ ] Logs mostrar separación clara
- [ ] Código cumple con style guide del proyecto

---

### FASE 3: Validación E2E (8-12 horas)

**Responsable:** Backend Engineer + QA  

**Test cases:**

- [ ] **Happy path:** ask() con systemInstruction separado
  - Input: pregunta "¿Cuáles son tus fortalezas?"
  - Expected: respuesta coherente, usando systemInstruction nativo
  - Verification: logs muestran `hasSystemInstruction: true`

- [ ] **Backwards compat:** ask() sin cambios en ChatController
  - Input: mismo endpoint, mismo request body
  - Expected: funciona como antes
  - Verification: respuesta idéntica (o mejor)

- [ ] **Streaming:** askStream() con systemInstruction
  - Input: same pregunta, streaming enabled
  - Expected: tokens llegan progresivamente
  - Verification: TTFT no afectado, TTFL óptimo

- [ ] **Gemini fallback:** cooldown + systemInstruction
  - Setup: simular Gemini en cooldown (GEMINI_COOLDOWN_MS=1000)
  - Input: ask con systemInstruction
  - Expected: fallback a Ollama, respuesta funcional
  - Verification: logs muestran `systemInstructionMergedToUserPrompt: true`

- [ ] **Ollama directo:** AI_PROVIDER=ollama
  - Setup: env AI_PROVIDER=ollama
  - Input: ask con systemInstruction
  - Expected: funciona (Ollama ignora o concatena)
  - Verification: respuesta válida

- [ ] **Metrics:** dashboard actualizado
  - Expected: métricas muestran systemInstructionLength
  - Verification: telemetry eventos en logs

---

### FASE 4: Deployment (4-6 horas)

**Responsable:** Backend Engineer + DevOps

- [ ] Code review + approval (1 reviewer)
- [ ] Merge a rama main
- [ ] Build Docker image: `backend:systemInstruction-v1`
- [ ] Test en staging (con Gemini API real)
- [ ] Monitor logs en staging (24h)
- [ ] Deploy a production (canary o gradual)
- [ ] Monitor en prod (7 días)
- [ ] Comunicar cambio al equipo

**Rollback plan:**
```
Si hay issues:
1. Revert commit
2. Rebuild image
3. Redeploy
```

---

## 4. DEPENDENCIAS

### Internas
- ✅ GEMINI_API_KEY configurada
- ✅ Ollama disponible (fallback)
- ✅ ChromaDB operativo (embeddings)
- ✅ MySQL operativo (metadata)

### Externas
- ✅ Gemini API v1.5+ (ya en uso)
- ✅ Node.js 18+ (ya en uso)

### No hay blockers conocidos.

---

## 5. RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| systemInstruction mal formatted | Baja | Alto | Validación estricta en PromptAssembler |
| Regresión en ask() | Baja | Alto | Unit + integration tests exhaustivos |
| Tokens overflow (sys+user) | Muy baja | Medio | Validación de longitudes |
| Gemini API rechazo systemInstruction | Muy baja | Alto | Testing con Gemini real antes de deploy |
| Ollama fallback inefectivo | Muy baja | Medio | Testing de concatenación |

**Risk score overall:** BAJO (cambios localizados, bien testeable)

---

## 6. TIMELINE ESTIMADO

| Fase | Estimado | Holgura | Total |
|------|----------|---------|-------|
| 1. AI Agent (prompt) | 16h | 8h | 24h |
| 2. Backend Engineer (impl) | 32h | 16h | 48h |
| 3. Validación E2E | 10h | 2h | 12h |
| 4. Deployment | 5h | 1h | 6h |
| **TOTAL** | **~63h** | **~27h** | **~90h** |

**Wall-time:** 1-2 sprints (si se ejecuta en paralelo: 3-5 days)

---

## 7. CRITERIOS DE ÉXITO

### Funcionalidad
- [ ] PromptAssembler.build() retorna { systemInstruction, userPrompt, compressionStats }
- [ ] GeminiProvider.generate(userPrompt, options, systemInstruction) funciona
- [ ] generateStream() soporta systemInstruction
- [ ] Fallback a Ollama concatena correctamente
- [ ] ChatController.ask/askStream siguen operativos

### Observabilidad
- [ ] Logs muestran systemInstructionLength > 0
- [ ] Auditoría: trazabilidad clara
- [ ] Dashboards muestran métricas de separación

### Quality
- [ ] `npm test` pasa (todos los tests)
- [ ] `get_errors` sin errores
- [ ] Code coverage > 85% (métodos afectados)
- [ ] Regression tests: PASS

### Performance
- [ ] TTFT (time to first token) no degradado
- [ ] TTFL (time to full response) igual o mejor
- [ ] Token cost <= baseline (esperar mejora)

---

## 8. CHECKLIST DE IMPLEMENTACIÓN

### Previo
- [ ] Leer REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md
- [ ] Leer INTERFACE_PROPOSAL_SYSTEM_INSTRUCTION.md
- [ ] Leer este documento

### FASE 1 (AI Agent)
- [ ] Redactar system prompt final
- [ ] Documento SYSTEM_PROMPT_DEFINITION.md
- [ ] Validación interna (coherencia)

### FASE 2 (Backend Engineer)
- [ ] Subtask 2.1: PromptAssembler
  - [ ] Código
  - [ ] Tests
  - [ ] Commits
- [ ] Subtask 2.2: GeminiProvider.generate()
  - [ ] Código
  - [ ] Tests
  - [ ] Commits
- [ ] Subtask 2.3: GeminiProvider.generateStream()
  - [ ] Código
  - [ ] Tests
  - [ ] Commits
- [ ] Subtask 2.4: ai/index.js
  - [ ] Código
  - [ ] Tests
  - [ ] Commits
- [ ] Subtask 2.5: ResponseService (OPCIONAL)
  - [ ] Código (si aplica)
  - [ ] Tests
  - [ ] Commits
- [ ] Subtask 2.6: Testing integral
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Regression tests
  - [ ] Commit
- [ ] Subtask 2.7: Documentation
  - [ ] README updates
  - [ ] JSDoc
  - [ ] Commits

### FASE 3 (E2E Validation)
- [ ] Happy path test
- [ ] Backwards compatibility test
- [ ] Streaming test
- [ ] Fallback test
- [ ] Ollama direct test
- [ ] Metrics test
- [ ] All tests PASS

### FASE 4 (Deployment)
- [ ] Code review approved
- [ ] Merged to main
- [ ] Docker image built
- [ ] Staging test (24h)
- [ ] Production canary
- [ ] Monitor production (7 días)

---

## 9. DOCUMENTOS ASOCIADOS

| Documento | Propósito | Audiencia |
|-----------|-----------|-----------|
| REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md | Diseño completo + decisiones | Backend AI Agent + Backend Engineer |
| INTERFACE_PROPOSAL_SYSTEM_INSTRUCTION.md | Interfaces detalladas + ejemplos | Backend Engineer |
| SYSTEM_PROMPT_DEFINITION.md | System prompt final | Backend AI Agent → Backend Engineer |
| Este documento | Roadmap + checklist | Orchestrator + Backend AI Agent + Backend Engineer |

---

## 10. PUNTOS DE CONTROL

### Control 1: Fin FASE 1
**Deliverable:** SYSTEM_PROMPT_DEFINITION.md

**Criterio de aceptación:**
- [ ] Prompt está documentado
- [ ] Es independiente de userPrompt
- [ ] Cubre rol, restricciones, formato
- [ ] AI Agent da "OK" para proceder

**Acción si falla:** Iterar en prompt

---

### Control 2: Fin FASE 2
**Deliverable:** Código implementado + tests

**Criterio de aceptación:**
- [ ] `npm test` PASS
- [ ] `get_errors` SIN errores
- [ ] Code review APPROVED
- [ ] Coverage > 85%

**Acción si falla:** Fixes + re-test

---

### Control 3: Fin FASE 3
**Deliverable:** E2E validation report

**Criterio de aceptación:**
- [ ] Todos los 6 test cases PASS
- [ ] Performance metrics OK
- [ ] Logs auditable

**Acción si falla:** Debug + re-test

---

### Control 4: Fin FASE 4
**Deliverable:** Deployment en producción

**Criterio de aceptación:**
- [ ] Código en main
- [ ] En staging 24h sin issues
- [ ] En production, monitoreado 7 días

**Acción si issues en prod:** Rollback inmediato

---

## 11. COMUNICACIÓN Y NOTIFICACIONES

### Ante Backend AI Agent
**Mensaje inicial:**
```
Objetivo: Redactar system prompt para Gemini que defina rol/comportamiento
del avatar del candidato en conversación con reclutador.

Restricciones:
- Max 400 caracteres
- Independiente de userPrompt
- Cubre: rol, restricciones, formato, tono

Entrega esperada: SYSTEM_PROMPT_DEFINITION.md
Plazo: 24h
```

### Ante Backend Engineer
**Mensaje post-AI Agent:**
```
El AI Agent ha redactado SYSTEM_PROMPT_DEFINITION.md

Tu tarea: implementar refactor en 4 archivos (GeminiProvider, PromptAssembler, ai/index.js, ResponseService)

Pasos:
1. Leer REFACTOR_SYSTEM_INSTRUCTION_DESIGN.md
2. Leer INTERFACE_PROPOSAL_SYSTEM_INSTRUCTION.md
3. Leer SYSTEM_PROMPT_DEFINITION.md
4. Implementar (subtasks 2.1 a 2.7)
5. Validación E2E (FASE 3)

Plazo: 48h para código + tests
Plazo: 12h para validación E2E
```

---

## 12. NOTAS FINALES

### Sobre el refactor
- **Impacto en ChatController:** CERO cambios requeridos
- **Impacto en clientes:** No hay cambios en respuesta (beneficio interno)
- **Rollout:** Seguro, backwards-compatible, bajo riesgo

### Sobre el sistema prompt
- **Responsabilidad:** Backend AI Agent
- **Validación:** Backend Engineer antes de commit
- **Iteración:** Si después del deploy es necesario ajustar, SOLO cambiar el string de systemInstruction en PromptAssembler (no código)

### Sobre futuros mejoras
- Este refactor sienta base para:
  - Dynamic system instructions (variar según contexto)
  - A/B testing de prompts
  - Multi-persona avatars
  - Language-specific system prompts
  - Fine-tuning más efectivo

---

**Fin de Roadmap & Checklist**  
**Status: LISTO PARA INICIAR FASE 1**
