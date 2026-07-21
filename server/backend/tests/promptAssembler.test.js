import { describe, it, expect } from 'vitest';
import { PromptAssembler } from '../modules/prompt/PromptAssembler.js';

const assembler = new PromptAssembler();

describe('PromptAssembler', () => {
    it('respeta límites de budget y no retorna string vacío', () => {
        const previous = {
            PROMPT_MAX_CHARS: process.env.PROMPT_MAX_CHARS,
            PROMPT_PROFILE_MAX_CHARS: process.env.PROMPT_PROFILE_MAX_CHARS,
            PROMPT_MEMORY_MAX_CHARS: process.env.PROMPT_MEMORY_MAX_CHARS,
        };

        process.env.PROMPT_MAX_CHARS = '120';
        process.env.PROMPT_PROFILE_MAX_CHARS = '60';
        process.env.PROMPT_MEMORY_MAX_CHARS = '30';

        try {
            const result = assembler.build({
                candidateName: 'Ana QA',
                profileContext: { usuario: { nombre: 'Ana', resumen: 'x'.repeat(400) } },
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

            if (previous.PROMPT_MEMORY_MAX_CHARS === undefined) delete process.env.PROMPT_MEMORY_MAX_CHARS;
            else process.env.PROMPT_MEMORY_MAX_CHARS = previous.PROMPT_MEMORY_MAX_CHARS;
        }
    });

    it('incluye bloques esperados en la estructura del prompt', () => {
        const result = assembler.build({
            candidateName: 'Ana QA',
            profileContext: { usuario: { nombre: 'Ana', resumen: 'Backend Engineer' } },
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

        expect(prompt).toContain('### HECHOS VERIFICABLES - PERFIL');
        expect(prompt).toContain('### HECHOS VERIFICABLES - MEMORIA');
        expect(prompt).toContain('### HECHOS VERIFICABLES - FAQ');
        expect(prompt).toContain('### SECCIONES PRIORIZADAS');
        expect(prompt).toContain('### PREGUNTA DEL RECRUITER');
        expect(prompt).toContain('### INSTRUCCIONES DE RESPUESTA');
        expect(prompt).toContain('[PERFIL:usuario]');
        expect(prompt).toContain('[FAQ:pregunta]');
    });

    it('refuerza politicas de fidelidad y estilo en systemInstruction', () => {
        const result = assembler.build({
            candidateName: 'Ana QA',
            profileContext: { usuario: { nombre: 'Ana' } },
            conversationMemory: null,
            faqHit: null,
            selectedSections: ['usuario'],
            question: 'Contame tu experiencia',
        });

        expect(result.systemInstruction).toContain('Responde SIEMPRE en primera persona del candidato');
        expect(result.systemInstruction).toContain('REGLA ORO ANTI-HALLUCINATION');
        expect(result.systemInstruction).toContain('Usa UNICAMENTE hechos verificables del contexto recibido');
        expect(result.systemInstruction).toContain('Frase de seguridad recomendada');
        expect(result.systemInstruction).toContain('Tono natural, humano y profesional para conversar con recruiter');
        expect(result.systemInstruction).toContain('Se conciso y preciso: responde en 2 a 5 frases cortas');
    });

    it('debería ejecutar pipeline de compresión', () => {
        const result = assembler.build({
            candidateName: 'Test User',
            profileContext: {
                sobre_mi: [{ descripcion: 'x'.repeat(500) }],
                experiencia_laboral: [
                    { puesto: 'Dev', empresa: 'Corp', descripcion: 'y'.repeat(300) },
                    { puesto: 'Dev2', empresa: 'Corp2', descripcion: 'z'.repeat(300) },
                ],
            },
            conversationMemory: null,
            selectedSections: ['experiencia_laboral'],
            question: 'test question',
            requestId: 'test-req',
        });

        expect(result).toHaveProperty('prompt');
        expect(result).toHaveProperty('compressionStats');
        expect(result.compressionStats).toHaveProperty('steps');
    });

    it('no recorta una sección priorizada por la intención aunque supere el cap por defecto', () => {
        const experiencias = Array.from({ length: 6 }, (_, i) => ({
            puesto: `Puesto ${i}`,
            empresa: `Empresa ${i}`,
            descripcion: 'detalle',
        }));

        const result = assembler.build({
            candidateName: 'Ana QA',
            profileContext: { experiencia_laboral: experiencias },
            conversationMemory: null,
            selectedSections: ['experiencia_laboral'],
            question: '¿Cuál fue tu primera experiencia laboral?',
        });

        const prompt = result.prompt || result;
        for (let i = 0; i < experiencias.length; i++) {
            expect(prompt).toContain(`Empresa ${i}`);
        }
    });

    it('sí recorta secciones no priorizadas al cap por defecto', () => {
        const experiencias = Array.from({ length: 6 }, (_, i) => ({
            puesto: `Puesto ${i}`,
            empresa: `Empresa ${i}`,
            descripcion: 'detalle',
        }));

        const result = assembler.build({
            candidateName: 'Ana QA',
            profileContext: { experiencia_laboral: experiencias },
            conversationMemory: null,
            selectedSections: ['idiomas'],
            question: '¿Qué idiomas hablás?',
        });

        const prompt = result.prompt || result;
        // Solo se conservan las últimas 4 (cap por defecto) al no estar priorizada.
        expect(prompt).not.toContain('Empresa 0');
        expect(prompt).toContain('Empresa 5');
    });
});
