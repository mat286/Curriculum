# Componentes del servidor

## 1. `backend/`

### `server.js`
Punto de entrada de la API.
- inicializa Express
- monta rutas
- expone `/health`
- aplica manejo centralizado de errores

### `config/`
Configuración compartida.

- `db.js`: crea el pool de conexiones MySQL
- `ollama.js`: centraliza URL, modelo y timeout de Ollama
- `chroma.js`: conecta con ChromaDB y crea colecciones por usuario

### `controllers/`
Orquestan cada caso de uso.

- `authController.js`: login con Google + emisión de JWT
- `chatController.js`: flujo principal del chat con router + DB + embeddings + respuesta final
- `userController.js`: lectura y actualización del perfil del usuario

### `services/`
Contienen la lógica reusable del negocio.

- `ollamaService.js`: cliente para generar texto y embeddings con Ollama
- `dataService.js`: consultas selectivas a MySQL
- `routerService.js`: usa la LLM para clasificar si una pregunta necesita datos o no
- `responseService.js`: arma la respuesta final como si hablara la persona
- `embeddingService.js`: indexa y busca contexto semántico en ChromaDB

### `prompts/`
Prompts versionados y separados del código.

- `router.prompt.js`: prompt de clasificación de intención
- `response.prompt.js`: prompt para responder como candidato

### `middlewares/`
Capas transversales.

- `authMiddleware.js`: valida el JWT
- `errorHandler.js`: normaliza errores HTTP
- `rateLimiter.js`: limita la cantidad de preguntas por minuto

### `routes/`
Define los endpoints REST.

- `auth.js`
- `user.js`
- `chat.js`

### `utils/`
Utilidades comunes.

- `jwt.js`: generar y verificar tokens
- `logger.js`: logs estructurados con `pino`

### `scripts/`
Tareas auxiliares.

- `indexEmbeddings.js`: reindexa embeddings para uno o todos los usuarios

---

## 2. `db/`

### `init.sql`
Crea el esquema inicial de la base con claves foráneas e índices.
Sirve para levantar un entorno nuevo desde cero con Docker.

---

## 3. `docker-compose.yml`

Se encarga de levantar:

### `mysql`
Base relacional principal donde vive la información estructurada del CV.

### `ollama`
Servicio de inferencia local para:
- router inteligente
- generación de respuesta final
- embeddings

### `chromadb`
Base vectorial liviana para RAG / búsqueda semántica.

### `backend`
API REST que conecta todo lo anterior.

---

## 4. `.env.example`

Define las variables esperadas:
- conexión a MySQL
- secreto JWT
- Google OAuth
- URL/modelo de Ollama
- URL de ChromaDB
- puerto y entorno
