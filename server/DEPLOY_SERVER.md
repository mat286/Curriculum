# Deploy en servidor

## 1. Requisitos mínimos recomendados

### Opción equilibrada
- 4 vCPU
- 8 GB RAM
- 30 GB SSD

### Opción recomendada para `mistral:7b`
- 6 a 8 vCPU
- 12 a 16 GB RAM
- 40 GB SSD

> Si tu servidor tiene GPU NVIDIA, Ollama puede ir bastante más rápido.

---

## 2. Variables de entorno

En `server/.env` deja estos valores como base:

```env
OLLAMA_MODEL=mistral:7b
OLLAMA_ROUTER_MODEL=llama3.2:1b
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_PREDICT=180
OLLAMA_NUM_CTX=3072
OLLAMA_NUM_THREAD=6
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=2
OLLAMA_FLASH_ATTENTION=1
OLLAMA_EMBEDDING_KEEP_ALIVE=60m
OLLAMA_CPU_LIMIT=8.0
OLLAMA_MEM_LIMIT=12g
OLLAMA_MEM_RESERVATION=6g
EMBEDDING_INDEX_BATCH_SIZE=12
```

Si el VPS es chico, usa:

```env
OLLAMA_MODEL=llama3.2:1b
OLLAMA_ROUTER_MODEL=llama3.2:1b
OLLAMA_NUM_THREAD=4
OLLAMA_MEM_LIMIT=4g
```

Para acelerar embeddings especificamente:

```env
OLLAMA_NUM_PARALLEL=6
OLLAMA_NUM_THREAD=8
OLLAMA_CPU_LIMIT=10.0
OLLAMA_MEM_LIMIT=14g
EMBEDDING_INDEX_BATCH_SIZE=16
```

Para mejorar TTFT/TTFB en rutas with_data (stream), agrega tambien:

```env
# Chat autenticado (/api/chat/ask/stream)
CHAT_WITH_DATA_STREAM_NUM_PREDICT=160
CHAT_WITH_DATA_STREAM_NUM_CTX=1536
CHAT_WITH_DATA_STREAM_TIMEOUT=90000

# Chat de candidato publico (/api/chat/candidate/:id/stream)
CANDIDATE_CHAT_STREAM_NUM_PREDICT=160
CANDIDATE_CHAT_STREAM_NUM_CTX=1536
CANDIDATE_CHAT_STREAM_TIMEOUT=90000
```

Si priorizas velocidad por sobre longitud de respuesta, prueba:

```env
CHAT_WITH_DATA_STREAM_NUM_PREDICT=120
CANDIDATE_CHAT_STREAM_NUM_PREDICT=120
```

Si notas respuestas demasiado cortas, vuelve a 160 o sube a 200.

Para mejorar la calidad de respuestas de IA (mejor retrieval + menos alucinacion), agrega tambien:

```env
# Retrieval semantico
SEMANTIC_TOPK_MIN=2
SEMANTIC_TOPK_DEFAULT=3
SEMANTIC_TOPK_MAX=5
DISABLE_RAG_BELOW_CONFIDENCE=0.3
SEMANTIC_MIN_SIMILARITY=0.68
SEMANTIC_MIN_SIMILARITY_BY_TYPE={"fact":0.74,"detail":0.69,"general":0.66}
SEMANTIC_NEAR_DUPLICATE_THRESHOLD=0.9
SEMANTIC_CHUNK_MAX_CHARS=420

# Hibrido BM25 + semantico
ENABLE_HYBRID_SEARCH=true
HYBRID_SEMANTIC_WEIGHT=0.6
HYBRID_BM25_WEIGHT=0.4
HYBRID_MAX_RESULTS=5
HYBRID_DEDUPE_THRESHOLD=0.8
ENABLE_RERANKING=true

# Presupuesto de contexto/prompt
PROMPT_MAX_CHARS=7200
PROMPT_PROFILE_MAX_CHARS=2200
PROMPT_SEMANTIC_MAX_CHARS=1800
PROMPT_SEMANTIC_MAX_CHUNKS=5
PROMPT_SEMANTIC_CHUNK_MAX_CHARS=280
PROMPT_MEMORY_MAX_CHARS=600
```

Preset recomendado (equilibrado calidad/latencia):
- Usa los valores de arriba tal cual.

Preset calidad alta (si tienes recursos y aceptas mas latencia):
- `SEMANTIC_TOPK_DEFAULT=4`
- `SEMANTIC_TOPK_MAX=6`
- `PROMPT_SEMANTIC_MAX_CHUNKS=6`
- `PROMPT_MAX_CHARS=8200`

Preset rapido (si priorizas velocidad):
- `SEMANTIC_TOPK_DEFAULT=2`
- `PROMPT_SEMANTIC_MAX_CHUNKS=4`
- `PROMPT_MAX_CHARS=6200`

Nota para Windows + Docker Desktop:
- Docker Desktop debe tener CPU/RAM asignados >= a `OLLAMA_CPU_LIMIT` y `OLLAMA_MEM_LIMIT`.
- Si Docker Desktop tiene menos recursos globales, los limites del compose no podran alcanzarse.

---

## 3. Subir el proyecto al servidor

```bash
scp -r server usuario@tu-servidor:/opt/entrevista-virtual/
scp -r frontend usuario@tu-servidor:/opt/entrevista-virtual/
```

O clona el repo directamente en el servidor.

---

## 4. Levantar backend + IA

```bash
cd /opt/entrevista-virtual/server
cp .env.example .env
nano .env

docker compose up -d --build
docker compose exec -T ollama ollama pull mistral:7b
docker compose exec -T ollama ollama pull llama3.2:1b
docker compose exec -T ollama ollama pull nomic-embed-text
docker compose exec -T backend node scripts/indexEmbeddings.js
curl http://localhost:3000/health
```

---

## 5. Build del frontend para producción

```bash
cd /opt/entrevista-virtual/frontend
cp .env.production.example .env.production
npm install
npm run build
```

Esto genera `frontend/dist/` para servir con Nginx.

---

## 6. Configurar frontend para apuntar al backend

En `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://api.tudominio.com
```

---

## 7. Recomendación de dominios

- Frontend: `https://tudominio.com`
- Backend/API: `https://api.tudominio.com`

---

## 8. Nginx sugerido

### Frontend
Sirve la carpeta `frontend/dist` como sitio estático.

### Backend
Haz proxy reverso a `http://127.0.0.1:3000`.

Ejemplo para API:

```nginx
server {
    server_name api.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Luego puedes sacar HTTPS con Certbot.

---

## 9. Comandos útiles de mantenimiento

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f ollama
docker compose restart backend
docker compose up -d --build
```

---

## 10. Checklist final antes de publicar

- [ ] `server/.env` con secretos reales
- [ ] `GOOGLE_CLIENT_ID` correcto
- [ ] modelos descargados en Ollama
- [ ] `curl http://localhost:3000/health` responde OK
- [ ] frontend compilado en `dist/`
- [ ] dominio apuntando al servidor
- [ ] HTTPS activo con Nginx/Certbot
