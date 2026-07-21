# Server del CV Conversacional con IA

Esta carpeta contiene **todo lo que va del lado del servidor**:

- **API REST** en Node.js / Express
- **IA conversacional** con Gemini (cloud)
- **Embeddings / RAG** locales con Ollama (solo `nomic-embed-text`) + ChromaDB
- **Base de datos** MySQL
- **Docker Compose** para levantar todo junto

> El `frontend/` queda separado a propósito y se ejecuta aparte.

---

## Estructura

```text
server/
├── backend/           # Código de la API REST y la lógica de IA
├── db/                # Schema SQL inicial de la base de datos
├── docker-compose.yml # Orquestación de servicios
├── .env.example       # Variables de entorno de ejemplo
└── docs/              # Documentación técnica
```

---

## Qué hace cada parte

### `backend/`
Es el corazón del sistema. Se encarga de:
- autenticar usuarios con Google
- exponer endpoints REST
- decidir si una pregunta necesita o no consultar la base
- consultar MySQL
- buscar contexto semántico con embeddings (Ollama + ChromaDB)
- pedirle la respuesta final a Gemini

### `db/`
Contiene `init.sql`, que crea las tablas del CV:
- `usuarios`
- `sobre_mi`
- `experiencia_laboral`
- `educacion`
- `cursos`
- `proyectos`
- `familia`
- `idiomas`
- `habilidades`
- `respuestas_entrevista`

### `docker-compose.yml`
Levanta 4 servicios:
1. `mysql`
2. `ollama`
3. `chromadb`
4. `backend`

### `.env.example`
Archivo modelo para crear tu `.env` real con claves y configuración.

---

## Configuración recomendada de IA

- **Conversacional:** Gemini (cloud, `AI_PROVIDER=gemini`, ver `GEMINI_MODEL` en `.env`)
- **Embeddings:** `nomic-embed-text` (Ollama local, solo para RAG)

Ollama en este proyecto **no** carga ningún modelo LLM (ni `mistral`, ni `llama3.2`) — únicamente sirve embeddings.

---

## Cómo levantar el servidor

### 1) Crear el archivo `.env`
En Windows PowerShell:

```powershell
cd server
Copy-Item .env.example .env
```

Después editá `.env` con tus valores reales.

### 2) Levantar los contenedores
```powershell
docker compose up -d
```

### 3) Descargar el modelo de embeddings en Ollama
```powershell
docker exec cv-ollama ollama pull nomic-embed-text
```

### 4) Indexar embeddings
```powershell
docker exec cv-backend node scripts/indexEmbeddings.js
```

### 5) Verificar salud del sistema
```powershell
curl http://localhost:3000/health
```

---

## Flujo general del chat

1. El usuario manda una pregunta al endpoint `POST /api/chat/ask`
2. El **router** (clasificador de intención) decide:
   - si puede responder directo, o
   - si necesita datos del CV
3. Si necesita datos:
   - consulta MySQL solo en las tablas necesarias
   - complementa con búsqueda semántica en ChromaDB (embeddings de Ollama)
4. Se hace la llamada final a Gemini con el contexto armado
5. La API devuelve la respuesta final como si hablara el candidato

---

## Documentación adicional

- `docs/COMPONENTES.md` → explica carpeta por carpeta y archivo por archivo
- `docs/API_Y_FLUJO.md` → endpoints, flujo del chat y responsabilidades
