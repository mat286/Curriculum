import provider from '../../ai/index.js';
import { ConversationMemoryService } from '../memory/ConversationMemoryService.js';
import { getFullProfile } from '../../services/dataService.js';
import { extractProfileUpdates } from '../../services/profileExtractionService.js';
import { buildProfileFillSystemPrompt } from '../../prompts/profileFillChat.prompt.js';
import logger from '../../utils/logger.js';

const REPLY_OPTIONS = { temperature: 0.4, numPredict: 300 };

/**
 * Orquestador del chat de autocompletado de perfil (isOwnChat). A diferencia
 * de ChatOrchestrator (RAG para que terceros pregunten sobre el candidato),
 * acá no hay retrieval — el candidato habla de sí mismo, así que en paralelo:
 *  (a) se genera una respuesta conversacional que guía con preguntas, y
 *  (b) se extrae, del mismo mensaje, una propuesta estructurada de perfil
 *      (mismo servicio que usa la carga de CV) para que el usuario confirme.
 */
export class ProfileFillOrchestrator {
    constructor() {
        this.memory = new ConversationMemoryService();
    }

    getSessionKey(userId) {
        return `session:${userId}:candidate:${userId}`;
    }

    persistTurnsInBackground({ sessionKey, userId, userMessage, assistantMessage }) {
        void Promise.allSettled([
            this.memory.addTurn({ sessionKey, candidateId: userId, requesterId: userId, role: 'user', content: userMessage }),
            this.memory.addTurn({ sessionKey, candidateId: userId, requesterId: userId, role: 'assistant', content: assistantMessage }),
        ]).then((results) => {
            const rejected = results.filter((r) => r.status === 'rejected');
            if (rejected.length > 0) {
                logger.warn({ userId, failedWrites: rejected.length }, 'profile-fill-chat: persistencia parcial falló');
            }
        });
    }

    async askStream({ userId, message, onToken }) {
        const sessionKey = this.getSessionKey(userId);
        const [memory, profile] = await Promise.all([
            this.memory.get(sessionKey),
            getFullProfile(userId),
        ]);

        const systemInstruction = buildProfileFillSystemPrompt({ profile, summary: memory.summary });

        const replyPromise = (async () => {
            let text = '';
            await provider.generateStream(message, REPLY_OPTIONS, (chunk) => {
                text += chunk;
                onToken(chunk);
            }, systemInstruction);
            return text.trim();
        })();

        const extractionPromise = extractProfileUpdates({
            sourceText: message,
            mode: 'chat',
            existingProfile: profile,
            conversationContext: memory.summary,
        });

        const [reply, proposedUpdate] = await Promise.all([replyPromise, extractionPromise]);

        this.persistTurnsInBackground({ sessionKey, userId, userMessage: message, assistantMessage: reply });

        return { reply, proposedUpdate };
    }
}

export const profileFillOrchestrator = new ProfileFillOrchestrator();
