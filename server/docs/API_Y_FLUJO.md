# API y flujo del sistema

## Endpoints principales

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/user/google` | Login con Google y generación de JWT |
| `GET` | `/api/user/:id` | Devuelve el perfil completo del usuario |
| `GET` | `/api/user/:id/data` | Devuelve datos básicos del usuario |
| `PUT` | `/api/user/:id/data` | Actualiza el perfil completo |
| `POST` | `/api/chat/ask` | Procesa el chat con routing inteligente |
| `GET` | `/health` | Verifica salud de MySQL, Ollama y ChromaDB |

---

## Flujo inteligente de chat

### Caso A: respuesta directa
Ejemplo: `hola`, `gracias`, `¿quién sos?`

1. entra la pregunta
2. `routerService` la clasifica
3. si `needs_db = false`, responde directo
4. no consulta MySQL ni embeddings

### Caso B: necesita datos
Ejemplo: `¿qué experiencia tenés en Node.js?`

1. entra la pregunta
2. `routerService` devuelve algo como:

```json
{
  "needs_db": true,
  "intent": "experience_query",
  "fields_required": ["experiencia_laboral", "habilidades", "proyectos"]
}
```

3. `dataService` consulta solo esas tablas
4. `embeddingService` busca contexto semántico relevante
5. `responseService` arma el prompt final
6. Ollama genera la respuesta en primera persona

---

## Ventajas de esta arquitectura

- **más eficiente**: no todo pasa por consultas completas a la base
- **más escalable**: responsabilidades separadas
- **más mantenible**: prompts, servicios y rutas desacoplados
- **más profesional**: Docker, health checks, logging, rate limit
- **mejor calidad de respuesta**: datos estructurados + RAG semántico

---

## Recomendación de despliegue

- `server/` en un servidor Linux o VM con Docker
- `frontend/` aparte, en Vercel/Netlify/Nginx
- si hay GPU, ejecutar Ollama en esa máquina
- si no hay GPU, usar un modelo más liviano
