import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { pool, ensureProfileSchema } from './config/db.js';
import { validateEnv } from './config/validateEnv.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import candidatesRoutes from './routes/candidates.js';
import candidateChatRoutes from './routes/candidateChat.js';
import recruiterRoutes from './routes/recruiter.js';
import metricsRoutes from './routes/metrics.js';
import internalChatMetricsRoutes from './routes/internalChatMetrics.js';
import { warmupModel } from './services/ollamaService.js';
import { OLLAMA_MODEL, OLLAMA_ROUTER_MODEL } from './config/ollama.js';

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configurar trust proxy para leer IP real cuando hay proxies (nginx, load balancer)
// Necesario para que rate limiters usen req.ip correcto
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Middlewares globales
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
    },
}));

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
    origin: (origin, callback) => {
        // Permitir peticiones sin origin (ej. curl, Postman, mobile)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' no permitido`));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(globalLimiter);

// Logging de requests
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        logger.debug({ method: req.method, path: req.path }, 'Request');
        next();
    });
}

// Rutas
app.use('/api/user', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat', candidateChatRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/internal', internalChatMetricsRoutes);

// Health check — verifica MySQL y Ollama
app.get('/health', async (req, res) => {
    const checks = { mysql: false, ollama: false, chromadb: false };

    try {
        await pool.query('SELECT 1');
        checks.mysql = true;
    } catch { /* MySQL no disponible */ }

    try {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const resp = await fetch(ollamaUrl, { signal: AbortSignal.timeout(3000) });
        checks.ollama = resp.ok;
    } catch { /* Ollama no disponible */ }

    try {
        const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
        const resp = await fetch(`${chromaUrl}/api/v2/heartbeat`, { signal: AbortSignal.timeout(3000) });
        checks.chromadb = resp.ok;
    } catch { /* ChromaDB no disponible */ }

    const allHealthy = checks.mysql && checks.ollama;
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: checks,
    });
});

// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler centralizado
app.use(errorHandler);

// Iniciar servidor
async function startServer() {
    try {
        await ensureProfileSchema();

        app.listen(PORT, () => {
            logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Servidor iniciado');
            Promise.resolve().then(() => warmupModel(OLLAMA_MODEL)).catch((error) => {
                logger.warn({ err: error, model: OLLAMA_MODEL }, 'Warmup principal de Ollama falló');
            });
            if (OLLAMA_ROUTER_MODEL !== OLLAMA_MODEL) {
                Promise.resolve().then(() => warmupModel(OLLAMA_ROUTER_MODEL)).catch((error) => {
                    logger.warn({ err: error, model: OLLAMA_ROUTER_MODEL }, 'Warmup de modelo router falló');
                });
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'No se pudo iniciar el servidor');
        process.exit(1);
    }
}

startServer();
