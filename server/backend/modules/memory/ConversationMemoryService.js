import { pool } from '../../config/db.js';
import logger from '../../utils/logger.js';

function summarize(messages, currentSummary = '') {
    const recent = messages.slice(-6);
    const summaryParts = recent.map((m) => `${m.role}: ${m.content}`);
    const merged = [currentSummary, ...summaryParts].filter(Boolean).join(' | ');
    return merged.length > 800 ? merged.slice(-800) : merged;
}

export class ConversationMemoryService {
    constructor() {
        this.l1 = new Map();
        this.maxMessages = 10;
    }

    async get(sessionKey) {
        const inMemory = this.l1.get(sessionKey);
        if (inMemory) return inMemory;

        try {
            const [rows] = await pool.query(
                'SELECT summary, last_messages FROM candidate_conversation_memory WHERE session_key = ? LIMIT 1',
                [sessionKey],
            );

            if (rows.length === 0) return { summary: '', messages: [] };

            const row = rows[0];
            const parsedMessages = typeof row.last_messages === 'string'
                ? JSON.parse(row.last_messages || '[]')
                : (row.last_messages || []);
            const value = {
                summary: row.summary || '',
                messages: Array.isArray(parsedMessages) ? parsedMessages : [],
            };
            this.l1.set(sessionKey, value);
            return value;
        } catch (error) {
            logger.warn({ err: error }, 'No se pudo cargar memory persistida, usando memoria temporal');
            return { summary: '', messages: [] };
        }
    }

    async addTurn({ sessionKey, candidateId, requesterId, role, content }) {
        const memory = await this.get(sessionKey);
        const nextMessages = [...memory.messages, { role, content, ts: Date.now() }].slice(-this.maxMessages);
        const nextSummary = summarize(nextMessages, memory.summary);

        const payload = { summary: nextSummary, messages: nextMessages };
        this.l1.set(sessionKey, payload);

        try {
            await pool.query(
                `
                    INSERT INTO candidate_conversation_memory (session_key, candidate_id, requester_id, summary, last_messages)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        summary = VALUES(summary),
                        last_messages = VALUES(last_messages),
                        updated_at = CURRENT_TIMESTAMP
                `,
                [sessionKey, candidateId, requesterId || null, nextSummary, JSON.stringify(nextMessages)],
            );
        } catch (error) {
            logger.warn({ err: error }, 'No se pudo persistir conversation memory');
        }

        return payload;
    }
}
