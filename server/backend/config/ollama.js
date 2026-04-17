const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b';
const OLLAMA_ROUTER_MODEL = process.env.OLLAMA_ROUTER_MODEL || 'llama3.2:1b';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '20m';
const OLLAMA_NUM_PREDICT = parseInt(process.env.OLLAMA_NUM_PREDICT || '160', 10);
const OLLAMA_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || '2048', 10);
const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.2');
const OLLAMA_NUM_THREAD = process.env.OLLAMA_NUM_THREAD ? parseInt(process.env.OLLAMA_NUM_THREAD, 10) : undefined;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

export {
    OLLAMA_URL,
    OLLAMA_MODEL,
    OLLAMA_ROUTER_MODEL,
    OLLAMA_TIMEOUT,
    OLLAMA_KEEP_ALIVE,
    OLLAMA_NUM_PREDICT,
    OLLAMA_NUM_CTX,
    OLLAMA_TEMPERATURE,
    OLLAMA_NUM_THREAD,
    EMBEDDING_MODEL,
};
