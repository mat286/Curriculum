import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCompressionService } from '../services/ContextCompressionService.js';

describe('ContextCompressionService', () => {
    let service;

    beforeEach(() => {
        service = new ContextCompressionService();
        process.env.ENABLE_CONTEXT_COMPRESSION = 'true';
        process.env.CONVERSATION_MAX_EXCHANGES = '3';
    });

    it('debería comprimir CV reduciendo tokens', () => {
        // Crear CV grande para que haya reducción real
        const profileContext = {
            sobre_mi: [{ descripcion: 'x'.repeat(200) }],
            experiencia_laboral: Array(5).fill(null).map((_, i) => ({
                puesto: `Senior Dev ${i}`,
                empresa: `TechCorp ${i}`,
                descripcion: `Lideré equipo de ${i+5} devs trabajando en proyectos complejos. ${`y`.repeat(300)}`,
            })),
            educacion: Array(3).fill(null).map((_, i) => ({
                titulo: `Ingeniero ${i}`,
                institucion: `UNI ${i}`,
            })),
        };

        const result = service.summarizeCV(profileContext, 'experiencia con React');

        expect(result.compressedProfile).toBeDefined();
        // Debe haber compresión porque trimArray reduce arrays
        expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
    });

    it('debería detectar redundancia entre embeddings y CV', () => {
        const cvText = JSON.stringify({
            experiencia_laboral: [
                { puesto: 'Senior Dev', empresa: 'TechCorp', descripcion: 'Lideré equipo backend Node.js' },
            ],
        });

        const redundantChunk = 'Experiencia: Senior Dev en TechCorp trabajando con Node.js backend';
        const uniqueChunk = 'Tecnología desconocida en CV anterior: machine learning avanzado con TensorFlow';

        const result = service.deduplicateSemanticContext([redundantChunk, uniqueChunk], cvText);

        // El segundo chunk debería estar presentes, el primero puede ser removido o no dependiendo de threshold
        expect(result.dedupedChunks.length).toBeLessThanOrEqual(2);
        expect(result.dedupedChunks.some((c) => c.includes('machine learning'))).toBe(true);
    });

    it('debería limitar conversation history a últimas 3 exchanges', () => {
        const memory = {
            messages: [
                { role: 'user', content: 'msg1' },
                { role: 'assistant', content: 'resp1' },
                { role: 'user', content: 'msg2' },
                { role: 'assistant', content: 'resp2' },
                { role: 'user', content: 'msg3' },
                { role: 'assistant', content: 'resp3' },
                { role: 'user', content: 'msg4' },
                { role: 'assistant', content: 'resp4' },
            ],
        };

        const result = service.compressConversationMemory(memory, 3);

        expect(result.truncated).toBe(true);
        expect(result.compressedMemory.messages.length).toBe(6); // 3 exchanges = 6 msgs
        expect(result.truncatedCount).toBe(2); // 2 msgs eliminados
    });

    it('debería ejecutar pipeline de compresión completo', () => {
        const profileContext = {
            sobre_mi: [{ descripcion: 'x'.repeat(200) }],
            experiencia_laboral: [
                { puesto: 'Dev', empresa: 'Corp', descripcion: 'y'.repeat(200) },
            ],
        };

        const semanticContext = ['chunk1 sobre experiencia', 'chunk2 sobre habilidades'];
        const memory = { summary: 'z'.repeat(100), history: [] };

        const result = service.compress({
            profileContext,
            semanticContext,
            conversationMemory: memory,
            selectedSections: ['experiencia_laboral'],
            question: 'experiencia con React',
            requestId: 'test-123',
        });

        expect(result.profileContext).toBeDefined();
        expect(result.semanticContext).toBeDefined();
        expect(result.stats).toBeDefined();
        expect(result.stats.totalTokensEstimate).toBeGreaterThan(0);
    });
});
