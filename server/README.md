# Server del CV Conversacional con IA

Esta carpeta contiene **todo lo que va del lado del servidor**:

- **API REST** en Node.js / Express
- **IA local** con Ollama
- **Base de datos** MySQL
- **Embeddings / RAG** con ChromaDB
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
- buscar contexto semántico con embeddings
- pedirle la respuesta final a Ollama

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

- **Conversacional:** `mistral:7b`
- **Router:** `llama3.2:1b`
- **Embeddings:** `nomic-embed-text`

Si el servidor tiene pocos recursos, puedes bajar temporalmente a `llama3.2:1b` también como modelo conversacional.

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

### 3) Descargar modelos en Ollama
```powershell
docker exec cv-ollama ollama pull mistral:7b
docker exec cv-ollama ollama pull llama3.2:1b
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
2. El **router LLM** decide:
   - si puede responder directo, o
   - si necesita datos del CV
3. Si necesita datos:
   - consulta MySQL solo en las tablas necesarias
   - complementa con búsqueda semántica en ChromaDB
4. Se hace una segunda llamada a Ollama
5. La API devuelve la respuesta final como si hablara el candidato

---

## Documentación adicional

- `docs/COMPONENTES.md` → explica carpeta por carpeta y archivo por archivo
- `docs/API_Y_FLUJO.md` → endpoints, flujo del chat y responsabilidades
