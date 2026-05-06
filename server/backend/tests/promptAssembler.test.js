import { describe, it, expect } from 'vitest';
import { PromptAssembler } from '../modules/prompt/PromptAssembler.js';

const assembler = new PromptAssembler();

describe('PromptAssembler', () => {
    it('respeta límites de budget y no retorna string vacío', () => {
        const previous = {
            PROMPT_MAX_CHARS: process.env.PROMPT_MAX_CHARS,
            PROMPT_PROFILE_MAX_CHARS: process.env.PROMPT_PROFILE_MAX_CHARS,
            PROMPT_SEMANTIC_MAX_CHARS: process.env.PROMPT_SEMANTIC_MAX_CHARS,
            PROMPT_MEMORY_MAX_CHARS: process.env.PROMPT_MEMORY_MAX_CHARS,
        };

        process.env.PROMPT_MAX_CHARS = '120';
        process.env.PROMPT_PROFILE_MAX_CHARS = '60';
        process.env.PROMPT_SEMANTIC_MAX_CHARS = '40';
        process.env.PROMPT_MEMORY_MAX_CHARS = '30';

        try {
            const result = assembler.build({
                candidateName: 'Ana QA',
                profileContext: { usuario: { nombre: 'Ana', resumen: 'x'.repeat(400) } },
                semanticContext: ['bloque uno', 'bloque dos', 'bloque tres'],
                conversationMemory: { summary: 'm'.repeat(200), messages: [] },
                selectedSections: ['usuario', 'habilidades'],
                question: '¿Qué tecnologías dominás?',
            });

            const prompt = result.prompt || result;

            // truncateText agrega "..." al truncar, por eso admitimos +3 chars.
            expect(prompt.length).toBeLessThanOrEqual(123);
            expect(prompt.length).toBeGreaterThan(0);
            
            // Validar que stats están presentes si result es objeto
            if (typeof result === 'object' && result.compressionStats) {
                expect(result.compressionStats).toBeDefined();
            }
        } finally {
            if (previous.PROMPT_MAX_CHARS === undefined) delete process.env.PROMPT_MAX_CHARS;
            else process.env.PROMPT_MAX_CHARS = previous.PROMPT_MAX_CHARS;

            if (previous.PROMPT_PROFILE_MAX_CHARS === undefined) delete process.env.PROMPT_PROFILE_MAX_CHARS;
            else process.env.PROMPT_PROFILE_MAX_CHARS = previous.PROMPT_PROFILE_MAX_CHARS;

            if (previous.PROMPT_SEMANTIC_MAX_CHARS === undefined) delete process.env.PROMPT_SEMANTIC_MAX_CHARS;
            else process.env.PROMPT_SEMANTIC_MAX_CHARS = previous.PROMPT_SEMANTIC_MAX_CHARS;

            if (previous.PROMPT_MEMORY_MAX_CHARS === undefined) delete process.env.PROMPT_MEMORY_MAX_CHARS;
            else process.env.PROMPT_MEMORY_MAX_CHARS = previous.PROMPT_MEMORY_MAX_CHARS;
        }
    });

    it('incluye bloques esperados en la estructura del prompt', () => {
        const result = assembler.build({
            candidateName: 'Ana QA',
            profileContext: { usuario: { nombre: 'Ana', resumen: 'Backend Engineer' } },
            semanticContext: ['Node.js', 'React', 'Microservicios'],
            conversationMemory: { summary: 'Hablamos de experiencia y stack.', messages: [] },
            faqHit: {
                hit: true,
                faq: {
                    question: '¿Cuál es tu disponibilidad?',
                    answer: 'Inmediata',
                },
            },
            selectedSections: ['usuario', 'experiencia_laboral'],
            question: '¿Cómo resolvés incidentes críticos?',
        });

        const prompt = result.prompt || result;

        expect(prompt).toContain('### ROL Y REGLAS');
        expect(prompt).toContain('### MEMORIA CONVERSACIONAL');
        expect(prompt).toContain('### SECCIONES PRIORIZADAS');
        expect(prompt).toContain('### FAQ RELEVANTE');
        expect(prompt).toContain('### PERFIL DEL CANDIDATO');
        expect(prompt).toContain('### CONTEXTO SEMANTICO');
        expect(prompt).toContain('### PREGUNTA');
        expect(prompt).toContain('### FORMATO DE RESPUESTA');
    });

    it('debería ejecutar pipeline de compresión', () => {
        const result = assembler.build({
            candidateName: 'Test User',
            profileContext: { 
                sobre_mi: [{ descripcion: 'x'.repeat(500) }],
                experiencia_laboral: [
                    { puesto: 'Dev', empresa: 'Corp', descripcion: 'y'.repeat(300) },
                    { puesto: 'Dev2', empresa: 'Corp2', descripcion: 'z'.repeat(300) },
                ] 
            },
            semanticContext: ['chunk1', 'chunk2', 'chunk3'],
            conversationMemory: null,
            selectedSections: ['experiencia_laboral'],
            question: 'test question',
            requestId: 'test-req',
        });

        expect(result).toHaveProperty('prompt');
        expect(result).toHaveProperty('compressionStats');
        expect(result.compressionStats).toHaveProperty('steps');
    });
});