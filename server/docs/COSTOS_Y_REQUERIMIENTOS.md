# Costos y Requerimientos Técnicos

## 1. ¿Qué es el Embedding y por qué es necesario?

### El pipeline completo de una consulta

Cuando un reclutador o visitante hace una pregunta al avatar, el sistema no le pasa todo el CV al modelo de IA. Eso sería caro (muchos tokens) y poco preciso. En cambio, usa **RAG (Retrieval-Augmented Generation)**:

```
Pregunta del usuario
       │
       ▼
 [Embedding] ← nomic-embed-text (Ollama, siempre local)
 Convierte la pregunta en un vector numérico de 768 dimensiones
       │
       ▼
 [ChromaDB] ← base de datos vectorial
 Busca los fragmentos del CV más similares semánticamente
 Ej: si preguntan "¿tenés experiencia con Docker?", ChromaDB
 devuelve solo los fragmentos que hablan de Docker o infraestructura
       │
       ▼
 [Proveedor IA] ← Gemini o Ollama
 Recibe: instrucción + solo los datos relevantes del CV + pregunta
 Genera la respuesta como si fuera la persona
       │
       ▼
 Respuesta al usuario
```

**¿Por qué importa el embedding?**
Sin ChromaDB, habría que enviar el CV completo al modelo en cada mensaje. Con un CV mediano (~3.000 palabras), eso serían ~4.000 tokens por consulta. Con RAG, se envían solo 2–3 fragmentos relevantes (~300–500 tokens). El ahorro es de 8–10x en tokens de entrada.

---

## 2. Flujo detallado por tipo de consulta

### Consulta al avatar de candidato (Chat con /:id)

El sistema hace **2 llamadas al proveedor IA** por cada mensaje del usuario:

```
1. Router (clasificador de intents)
   Input:  system prompt + mensaje del usuario
   Output: JSON con { needs_db, fields_required, ... }

2. Respuesta (solo si needs_db = true)
   Input:  instrucción + datos del CV (solo campos relevantes) + RAG results + pregunta
   Output: respuesta en primera persona
```

Si `needs_db = false` (saludo, despedida), solo se hace la llamada 1.

### Consulta del recruiter (fase collect)

**1 llamada** con el historial de conversación acumulado.

### Búsqueda del recruiter (fase rank)

**1 llamada** con la lista de candidatos a evaluar.

---

## 3. Estimación de tokens por consulta

> **Referencia de conteo**: ~1 token ≈ 4 caracteres en inglés / 3–3.5 caracteres en español.
> Los valores son estimaciones basadas en los prompts actuales del sistema.

### 3.1 Consulta típica al avatar (pregunta sobre experiencia)

| Componente | Tokens entrada | Tokens salida |
|---|---|---|
| System prompt del router | ~380 tok | — |
| Mensaje del usuario ("¿Qué experiencia tenés en backend?") | ~15 tok | — |
| **Subtotal llamada 1 (router)** | **~395 tok** | **~30 tok (JSON)** |
| System prompt de respuesta + instrucción | ~220 tok | — |
| Datos del CV compactados (2–3 campos) | ~400 tok | — |
| Resultados de RAG (2 fragmentos) | ~200 tok | — |
| Pregunta del usuario | ~15 tok | — |
| **Subtotal llamada 2 (respuesta)** | **~835 tok** | **~120 tok** |
| **TOTAL por consulta completa** | **~1.230 tok entrada** | **~150 tok salida** |

### 3.2 Saludo simple (needs_db = false)

| Componente | Tokens entrada | Tokens salida |
|---|---|---|
| System prompt del router | ~380 tok | — |
| Mensaje del usuario ("Hola") | ~3 tok | — |
| **TOTAL (solo 1 llamada)** | **~383 tok entrada** | **~30 tok salida** |

### 3.3 Recruiter — fase collect (por turno de conversación)

| Componente | Tokens entrada | Tokens salida |
|---|---|---|
| System prompt del recruiter | ~680 tok | — |
| Historial acumulado (promedio 3 turnos) | ~150 tok | — |
| Perfil parcial en JSON | ~80 tok | — |
| Mensaje del usuario | ~20 tok | — |
| **TOTAL por turno** | **~930 tok entrada** | **~80 tok salida** |

> El historial crece con cada turno. En promedio una sesión de collect tiene 2–3 turnos antes de completar el perfil.

### 3.4 Recruiter — fase rank (por búsqueda)

| Componente | Tokens entrada | Tokens salida |
|---|---|---|
| System prompt del ranker | ~180 tok | — |
| Perfil buscado (jobProfile JSON) | ~80 tok | — |
| Lista de candidatos (top 8, datos compactados) | ~600 tok | — |
| **TOTAL por búsqueda** | **~860 tok entrada** | **~200 tok salida** |

---

## 4. Costo en dinero — Caso A: AI_PROVIDER=gemini

**Modelo:** `gemini-2.0-flash`

**Precios (Abril 2026):**
| Tipo | Precio |
|---|---|
| Entrada (texto) | USD 0.10 / 1M tokens |
| Salida (texto) | USD 0.40 / 1M tokens |
| Free tier | 15 RPM, 1.000.000 tokens/día gratis |

### Costo por consulta (Gemini)

| Caso | Tokens entrada | Tokens salida | Costo estimado |
|---|---|---|---|
| Pregunta sobre CV completa (2 llamadas) | ~1.230 | ~150 | **USD 0.000183** |
| Saludo simple (1 llamada) | ~383 | ~30 | **USD 0.000050** |
| Recruiter collect (por turno) | ~930 | ~80 | **USD 0.000125** |
| Recruiter rank (por búsqueda) | ~860 | ~200 | **USD 0.000166** |

### Proyección mensual (Gemini)

| Escenario | Consultas/día | Costo/mes estimado |
|---|---|---|
| Demo / uso personal | 20 | ~USD 0.10 |
| Uso activo (1–3 usuarios) | 100 | ~USD 0.55 |
| Uso moderado (10 usuarios) | 500 | ~USD 2.75 |
| Uso intensivo (50 usuarios) | 2.000 | ~USD 11.00 |

> El free tier de Gemini (1M tokens/día) cubre cómodamente los primeros dos escenarios sin pagar nada.

---

## 5. Costo en dinero — Caso B: AI_PROVIDER=ollama

Con Ollama corriendo localmente (o en un VPS), el costo marginal por consulta es **USD 0.00** — se paga solo el hardware/electricidad.

El costo real es el del servidor o la máquina donde corre Ollama.

### Requerimientos de hardware por modelo

| Modelo | RAM GPU/CPU | Uso |
|---|---|---|
| `mistral:7b` (Q4) | 4.5 GB | Generación de respuestas |
| `llama3.2:1b` (Q4) | 800 MB | Router (clasificador) |
| `nomic-embed-text` | 270 MB | Embeddings (también en Gemini mode) |
| **Total con todo Ollama** | **~5.6 GB** | — |
| **Total con solo embeddings** | **~300 MB** | Cuando AI_PROVIDER=gemini |

### Costo de servidor (referencia VPS — Abril 2026)

| Configuración | Proveedor (ref.) | Precio/mes | Capacidad |
|---|---|---|---|
| 2 vCPU / 4 GB RAM | DigitalOcean / Hetzner | ~USD 12–20 | Solo embeddings (AI_PROVIDER=gemini) |
| 4 vCPU / 8 GB RAM | DigitalOcean / Hetzner | ~USD 30–50 | Ollama completo (modelos 7B en CPU) |
| 4 vCPU / 16 GB RAM + GPU | RunPod / vast.ai | ~USD 0.30/hr | Ollama completo con GPU (rápido) |

> En CPU pura, `mistral:7b` tarda ~15–45 segundos por respuesta según el hardware. Con GPU tarda ~1–3 segundos.

---

## 6. Comparativa directa

| Criterio | AI_PROVIDER=gemini | AI_PROVIDER=ollama |
|---|---|---|
| **Costo por consulta** | ~USD 0.00018 | USD 0 (solo hardware) |
| **Costo infraestructura mínima** | VPS 2 GB RAM (~USD 12/mes) | VPS 8–16 GB RAM (~USD 30–50/mes) |
| **Velocidad de respuesta** | 1–3 segundos | 5–45 seg (CPU) / 1–3 seg (GPU) |
| **Privacidad de datos** | Los prompts van a servidores de Google | 100% local, sin salida de datos |
| **Dependencia externa** | Requiere internet + API Key válida | Funciona offline |
| **Límite de requests** | 15 RPM (free) / ilimitado (pagado) | Sin límite |
| **Calidad de respuesta** | Alta (Gemini Flash es muy capaz) | Alta (Mistral 7B es sólido) |
| **Embeddings** | Siempre Ollama local | Siempre Ollama local |
| **Mantenimiento modelos** | Ninguno (Google los actualiza) | Requiere descargar/actualizar modelos |

---

## 7. Recomendación según caso de uso

| Caso | Recomendación |
|---|---|
| Demo / portfolio personal | **Gemini** — free tier más que suficiente, sin costo de infraestructura pesada |
| Startup / producto con usuarios reales | **Gemini** con plan pagado — escala sin gestionar GPU |
| Empresa con requisitos de privacidad | **Ollama** — datos nunca salen del servidor |
| Desarrollo / testing local | **Ollama** — sin consumir cuota de API |
| Servidor propio con GPU disponible | **Ollama** — costo por consulta USD 0 con buena velocidad |

---

## 8. Cómo cambiar el proveedor

Editar `server/.env`:

```env
# Usar Gemini (por defecto)
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key_aqui
GEMINI_MODEL=gemini-2.0-flash

# Usar Ollama
# AI_PROVIDER=ollama
```

Luego reconstruir el backend:

```bash
docker compose up -d --build backend
```

El log de arranque confirma el proveedor activo:
```
{"msg":"Proveedor IA: Gemini (gemini-2.0-flash)"}
{"msg":"[ENV] ✅ Proveedor IA activo: GEMINI"}
```

---

## 9. Notas sobre los embeddings

Los embeddings (`nomic-embed-text` vía Ollama) **siempre corren localmente**, independientemente del proveedor de texto configurado. Esto es intencional por dos razones:

1. **Consistencia vectorial**: ChromaDB almacena vectores de 768 dimensiones generados por `nomic-embed-text`. Si se cambiara el modelo de embeddings, todos los vectores existentes quedarían incompatibles y habría que re-indexar todo el contenido.

2. **Costo**: Generar embeddings con Gemini tiene un costo adicional (~USD 0.00 en free tier, pero suma al presupuesto). Como los embeddings se generan solo una vez al indexar el CV (no en cada consulta), y la consulta de similitud es solo matemática (producto escalar sobre vectores ya almacenados), mantenerlos en Ollama es la opción más eficiente.

**¿Cuándo se generan embeddings?**
- Al correr `node scripts/indexEmbeddings.js` (una sola vez, o al actualizar el CV)
- No se generan embeddings en cada consulta del usuario — solo se busca por similitud en los vectores ya almacenados

**Costo de una consulta de RAG:**
- Generar 1 embedding de la pregunta del usuario: ~5–10ms en CPU, USD 0
- Búsqueda en ChromaDB (operación de álgebra lineal): ~1–5ms, USD 0
