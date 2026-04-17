# Backend

Este backend expone la API REST del sistema y conecta:
- autenticación
- base de datos MySQL
- Ollama
- embeddings con ChromaDB

## Carpetas importantes
- `controllers/`: coordinación de cada endpoint
- `services/`: lógica del negocio
- `prompts/`: prompts separados del código
- `middlewares/`: auth, rate limit y manejo de errores
- `config/`: conexiones y settings

## Punto de entrada
- `server.js`

## Endpoint principal de IA
- `POST /api/chat/ask`

## Idea central
La LLM **no responde siempre directo**. Primero clasifica la intención, y recién después decide si necesita buscar datos del CV.
