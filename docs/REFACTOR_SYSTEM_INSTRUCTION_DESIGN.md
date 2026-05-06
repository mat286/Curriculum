# Diseño Arquitectónico: System Instructions Separadas en GeminiProvider

**Estado:** Diseño preliminar (Sin implementación)  
**Fecha:** Mayo 2026  
**Objetivo:** Refactorizar GeminiProvider.js y PromptAssembler.js para soportar system instructions separadas en Gemini API v1.5+

---

## 1. ESTADO ACTUAL (Before)

### Flujo actual de generación

```
ChatController.ask() / askStream()
    ↓
PromptAssembler.build()  
    └─→ { prompt: "concatenated string", compressionStats }
    ↓
ResponseService.generateResponseFromPrompt(prompt)
    ↓
ai/index.js (factory wrapper)
    ↓
GeminiProvider.generate(prompt, options)
    └─→ model.generateContent(prompt)  // TODO: sin systemInstruction
```

### Problema actual

**En PromptAssembler.build():**
- Concatena **TODO** (ROL, REGLAS, MEMORIA, PERFIL, CONTEXTO SEMÁNTICO, PREGUNTA) en un único string
- No separa instrucciones del sistema del contexto del usuario
- Pérdida de semántica: el modelo no distingue qué es "instrucción de sistema" vs "datos"

**En GeminiProvider.generate():**
- Firma: `generate(prompt, options)` – sin parámetro systemInstruction
- `getGenerativeModel()` se llama sin campo `systemInstruction`
- No aprovecha capacidad nativa de Gemini v1.5+

**Impacto:**
- Presión indebida en el contexto del usuario (tokens)
- Modelo menos propenso a seguir instrucciones del sistema
- Auditoría/logging complejo (imposible separar qué fue "instrucción" vs "contexto")

---

## 2. DISEÑO PROPUESTO (After)

### 2.1 Refactor PromptAssembler.build()

**Objetivo:** Retornar un objeto que separe explícitamente system instructions del user prompt.

#### Firma actual (mantener para compatibilidad)
```javascript
build({
  candidateName,
  profileContext,
  semanticContext,
  conversationMemory,
  faqHit,
  selectedSections,
  question,
  requestId,
})
```

#### Retorno propuesto
```javascript
{
  systemInstruction: string,     // ← NUEVO: instrucciones del sistema
  userPrompt: string,            // ← NUEVO: contexto + pregunta
  compressionStats: object       // ← EXISTENTE
}
```

#### Distribución de contenido

| Componente | Va a | Razón |
|-----------|------|-------|
| **ROL Y REGLAS** | `systemInstruction` | Son instrucciones que definen comportamiento |
| **MEMORIA CONVERSACIONAL** | `userPrompt` | Es contexto histórico, necesario para understanding |
| **SECCIONES PRIORIZADAS** | `userPrompt` | Es data de contexto |
| **FAQ RELEVANTE** | `userPrompt` | Es información de soporte |
| **PERFIL DEL CANDIDATO** | `userPrompt` | Es el contexto principal |
| **CONTEXTO SEMÁNTICO** | `userPrompt` | Es retrieval RAG |
| **PREGUNTA** | `userPrompt` | Es la query del usuario |
| **FORMATO DE RESPUESTA** | `systemInstruction` | Son instrucciones sobre cómo responder |

#### Pseudocódigo de retorno (NO código real)
```
systemInstruction = [
  "Eres ${candidateName}. Un reclutador habla con tu avatar profesional.",
  "Responde en primera persona, clara y concisa.",
  "No inventes información.",
  "Respuesta en 3-6 líneas."
].join("\n")

userPrompt = [
  "### MEMORIA CONVERSACIONAL",
  memory summary,
  "",
  "### SECCIONES PRIORIZADAS",
  sections list,
  "",
  "### PERFIL DEL CANDIDATO",
  profile JSON,
  "",
  "### CONTEXTO SEMÁNTICO",
  semantic hits,
  "",
  "### PREGUNTA",
  question,
].filter(Boolean).join("\n\n")

return {
  systemInstruction,
  userPrompt,
  compressionStats
}
```

---

### 2.2 Refactor GeminiProvider.generate() y generateStream()

**Objetivo:** Pasar `systemInstruction` a `getGenerativeModel()` cuando está disponible.

#### Firma propuesta

**Actual:**
```javascript
generate(prompt, options)
generateStream(prompt, options, onChunk)
```

**Propuesta:**
```javascript
generate(userPrompt, options, systemInstruction)
generateStream(userPrompt, options, onChunk, systemInstruction)
```

#### Lógica de implementación

```
function generate(userPrompt, options = {}, systemInstruction) {
  
  // 1. Validar inputs
  if (!userPrompt) throw LLMError
  if (systemInstruction && typeof systemInstruction !== 'string') throw LLMError
  
  // 2. Build modelConfig
  modelConfig = {
    model: GEMINI_MODEL,
    generationConfig: { ... options ... }
  }
  
  // 3. NUEVO: Pasar systemInstruction si está presente
  if (systemInstruction && systemInstruction.trim().length > 0) {
    modelConfig.systemInstruction = systemInstruction  // ← KEY FEATURE
  }
  
  // 4. Resto del flujo igual (getGenerativeModel, timeout, try/catch, etc)
  model = client.getGenerativeModel(modelConfig)
  result = await model.generateContent(userPrompt.trim())
  return result.response.text().trim()
}
```

#### Fallback automático

Si `systemInstruction` no es pasado o es null/empty:
- Comportamiento idéntico al actual (solo `userPrompt` en generateContent)
- Compatibilidad hacia atrás garantizada

#### Para generateStream()
- Idéntica lógica que `generate()`
- `modelConfig.systemInstruction` se asigna antes de `getGenerativeModel()`

---

## 3. IMPACTO EN CAPAS SUPERIORES

### 3.1 ResponseService (mínimos cambios)

**Actual:**
```javascript
export function generateResponseFromPrompt(prompt) {
  return generate(prompt, RESPONSE_OPTIONS)  // ← ai/index.js.generate()
}
```

**Propuesta:**
```javascript
export function generateResponseFromPrompt(userPrompt, systemInstruction, options) {
  return generate(userPrompt, options, systemInstruction)  // ← ai/index.js.generate()
}
```

**Nota:** ChatController.js puede seguir llamando igual si no hay systemInstruction → fallback automático

---

### 3.2 Wrapper (ai/index.js)

El factory wrapper debe:

1. **Pasar systemInstruction al provider actual:**
   ```javascript
   async generate(userPrompt, options, systemInstruction) {
     // Si Gemini está en cooldown:
     if (gemini.isInQuotaCooldown()) {
       // Ollama NO soporta systemInstruction nativo
       // → Fallback: concatenar systemInstruction + userPrompt
       const concatenated = systemInstruction 
         ? `${systemInstruction}\n\n${userPrompt}`
         : userPrompt;
       return ollama.generate(concatenated, options);
     }
     // Si no:
     try {
       return await gemini.generate(userPrompt, options, systemInstruction);
     } catch (err) {
       if (err.isQuotaError || err.isNetworkError) {
         const concatenated = systemInstruction 
           ? `${systemInstruction}\n\n${userPrompt}`
           : userPrompt;
         return ollama.generate(concatenated, options);
       }
     }
   }
   ```

2. **Lo mismo para generateStream()**

---

### 3.3 ChatController.js

**SIN CAMBIOS NECESARIOS** si se mantiene compatibilidad hacia atrás:

```javascript
// Código actual puede seguir así:
const { prompt, compressionStats } = promptAssembler.build({ ... });
const answer = await generateResponseFromPrompt(prompt);

// O aprovechar nuevas separación (OPCIONAL):
const { systemInstruction, userPrompt, compressionStats } = promptAssembler.build({ ... });
const answer = await generateResponseFromPrompt(userPrompt, systemInstruction);
```

---

## 4. INTERFAZ DE CAMBIOS

### 4.1 PromptAssembler

| Método | Before | After | Notas |
|--------|--------|-------|-------|
| `build()` | Retorna `{ prompt, compressionStats }` | Retorna `{ systemInstruction, userPrompt, compressionStats }` | Compatibilidad: si código viejo accede a `.prompt`, puede usar `.userPrompt` |

### 4.2 GeminiProvider

| Método | Before | After | Notas |
|--------|--------|-------|-------|
| `generate(prompt, options)` | 2 parámetros | `(userPrompt, options, systemInstruction)` | 3er parámetro es opcional (default = null) |
| `generateStream(prompt, options, onChunk)` | 3 parámetros | `(userPrompt, options, onChunk, systemInstruction)` | 4to parámetro es opcional |

### 4.3 ai/index.js (factory)

**Métodos exportados:**
```javascript
provider.generate(userPrompt, options, systemInstruction)
provider.generateStream(userPrompt, options, onChunk, systemInstruction)
provider.generateJSON(prompt, fallback, options)  // Sin cambios
```

---

## 5. MATRIZ DE COMPATIBILIDAD

| Escenario | Gemini Activo | Gemini en Cooldown | Ollama Directo | Resultado |
|-----------|---------------|-------------------|---|-----------|
| `systemInstruction` pasado | ✅ Nativo en modelConfig | ⚠️ Concatena + Ollama | N/A | Completo |
| `systemInstruction` null/undefined | ✅ Comportamiento actual | ✅ Solo userPrompt a Ollama | ✅ Solo prompt | Compatible |
| `systemInstruction` vacío `""` | ✅ Omitido en modelConfig | ⚠️ Omitido, Ollama recibe solo userPrompt | ✅ Solo prompt | Compatible |

---

## 6. VALIDACIONES ESPERADAS

### En PromptAssembler.build()
- [ ] `systemInstruction` no supera X caracteres (ej. 500)
- [ ] `userPrompt` no supera PROMPT_MAX_CHARS (ej. 7200)
- [ ] Ambos son strings no-vacíos después de trim()
- [ ] No hay XSS/injection en ninguno

### En GeminiProvider
- [ ] Si `systemInstruction` es string y no vacío → pasar a modelConfig
- [ ] Si `systemInstruction` es null/undefined/vacío → omitir de modelConfig
- [ ] Resto de validaciones igual (timeout, error handling)

---

## 7. CAMBIOS EN LOGGING/AUDITORÍA

### Logging propuesto

```javascript
// En GeminiProvider.generate()
logger.debug({
  requestId,
  hasSystemInstruction: !!systemInstruction,
  systemInstructionLength: systemInstruction?.length ?? 0,
  userPromptLength: userPrompt.length,
  totalTokensEstimate: (systemInstruction?.length ?? 0) + userPrompt.length / 4,
}, 'gemini:generate called')

// En caso de fallback a Ollama
logger.warn({
  reason: 'quota_or_network',
  fallbackMode: 'concatenate',
  systemInstructionMergedToUserPrompt: !!systemInstruction,
}, 'gemini→ollama fallback')
```

---

## 8. DIAGRAMA DE FLUJO PROPUESTO

```
┌─────────────────────────────────────────────────────────────┐
│ chatController.ask/askStream()                               │
│ - Recupera userData, semanticHits                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ PromptAssembler.build()        │
        │                                │
        │ Input: profile, semantic, ...  │
        │                                │
        │ Output: {                      │
        │   systemInstruction: string,   │ ◄── NUEVO FIELD
        │   userPrompt: string,          │ ◄── NUEVO FIELD
        │   compressionStats: {...}      │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ ResponseService                │
        │ .generateResponseFromPrompt    │
        │ (userPrompt, systemInstruction)│ ◄── ACTUALIZADO
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ ai/index.js (factory)          │
        │ .generate(userPrompt, options, │
        │           systemInstruction)   │ ◄── ACTUALIZADO
        └────────────┬───────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────────┐    ┌──────────────────┐
    │ GeminiProvider  │    │ OllamaProvider   │
    │ .generate()     │    │ .generate()      │
    │                 │    │                  │
    │ modelConfig: {  │    │ No soporta       │
    │   systemInst... │    │ systemInstruction│
    │ }               │    │ → concatenar     │
    └─────────────────┘    └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ LLM Response     │
            │ (streamed token) │
            └──────────────────┘
```

---

## 9. CRITERIOS DE VALIDACIÓN

Después de implementar:

- [ ] `get_errors` sin errores de sintaxis/tipos
- [ ] Flujo `ask` operativo: pregunta → respuesta (sin systemInstruction explícito)
- [ ] Flujo `askStream` operativo: streaming token-a-token
- [ ] Cuando `systemInstruction` es pasado: Gemini lo recibe en modelConfig
- [ ] Cuando `systemInstruction` no es pasado: Gemini usa comportamiento anterior (compatible)
- [ ] En fallback a Ollama: systemInstruction concatenado con userPrompt
- [ ] Logs muestran separación clara (systemInstruction length ≠ 0)
- [ ] Tests unitarios para PromptAssembler.build() regresan 3 fields
- [ ] Tests unitarios para GeminiProvider.generate() validan systemInstruction
- [ ] Chatcontroller.js SIN cambios necesarios (si no quiere usar el nuevo feature)

---

## 10. DECISIONES ARQUITECTÓNICAS CLAVE

| Decisión | Justificación |
|----------|--------------|
| **systemInstruction en PromptAssembler** | Separación clara entre qué es "instrucción" vs "contexto" en la lógica de negocio |
| **3er parámetro en GeminiProvider.generate()** | Firma familiar (apiPrompt, options, systemInstruction) |
| **Fallback en factory (concatenar)** | Ollama no soporta systemInstruction → mantener compatibilidad funcional |
| **Compatibilidad hacia atrás** | ChatController no requiere cambios; systemInstruction es optional |
| **Auditoría en logs** | Separación clara para debugging y análisis de tokens |

---

## 11. SIGUIENTES PASOS (IMPLEMENTACIÓN)

1. **Backend AI Agent:**
   - Redactar prompt de sistema comprensivo para Gemini
   - Documentar qué va en systemInstruction vs userPrompt
   - Proponer ajustes a la división si es necesario

2. **Backend Engineer:**
   - Implementar PromptAssembler.build() con 3 fields
   - Implementar GeminiProvider.generate(userPrompt, options, systemInstruction)
   - Implementar GeminiProvider.generateStream(..., systemInstruction)
   - Actualizar factory (ai/index.js) con fallback
   - Actualizar ResponseService (opcional, pero recomendado)
   - Agregar tests

3. **Validación:**
   - Tests de unidad + integración
   - E2E con Gemini real
   - Monitoreo en producción
