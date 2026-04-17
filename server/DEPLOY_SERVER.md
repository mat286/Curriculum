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
OLLAMA_CPU_LIMIT=6.0
OLLAMA_MEM_LIMIT=8g
OLLAMA_MEM_RESERVATION=4g
```

Si el VPS es chico, usa:

```env
OLLAMA_MODEL=llama3.2:1b
OLLAMA_ROUTER_MODEL=llama3.2:1b
OLLAMA_NUM_THREAD=4
OLLAMA_MEM_LIMIT=4g
```

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
