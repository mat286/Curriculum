import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateJSONMock = vi.fn();

vi.mock('../ai/index.js', () => ({
    default: { generateJSON: (...args) => generateJSONMock(...args) },
}));

import { extractProfileUpdates } from '../services/profileExtractionService.js';

describe('profileExtractionService', () => {
    beforeEach(() => {
        generateJSONMock.mockReset();
    });

    it('devuelve el fallback vacío si no hay texto fuente', async () => {
        const result = await extractProfileUpdates({ sourceText: '', mode: 'chat' });
        expect(generateJSONMock).not.toHaveBeenCalled();
        expect(result.candidateFields).toEqual({});
        expect(result.sections.habilidades).toEqual([]);
    });

    it('usa numPredict/timeout más altos en modo cv que en modo chat', async () => {
        generateJSONMock.mockResolvedValue({ candidateFields: {}, sections: {} });

        await extractProfileUpdates({ sourceText: 'texto de cv', mode: 'cv' });
        const cvOptions = generateJSONMock.mock.calls[0][2];

        await extractProfileUpdates({ sourceText: 'hola', mode: 'chat' });
        const chatOptions = generateJSONMock.mock.calls[1][2];

        expect(cvOptions.numPredict).toBeGreaterThan(chatOptions.numPredict);
        expect(cvOptions.timeout).toBeGreaterThan(chatOptions.timeout);
    });

    it('filtra campos no-string de candidateFields y descarta filas inválidas de sections', async () => {
        generateJSONMock.mockResolvedValue({
            candidateFields: { nombre: 'Ana', puestoActual: 123, resumen: '  ' },
            sections: {
                habilidades: [{ nombre: 'Python' }, 'no es un objeto', ['tampoco'], null],
                idiomas: null,
            },
        });

        const result = await extractProfileUpdates({ sourceText: 'trabajé en X', mode: 'chat' });

        expect(result.candidateFields).toEqual({ nombre: 'Ana' });
        expect(result.sections.habilidades).toEqual([{ nombre: 'Python' }]);
        expect(result.sections.idiomas).toEqual([]);
    });

    it('siempre devuelve las 6 claves de sections aunque el LLM no las incluya', async () => {
        generateJSONMock.mockResolvedValue({ candidateFields: {}, sections: { habilidades: [{ nombre: 'Excel' }] } });

        const result = await extractProfileUpdates({ sourceText: 'algo', mode: 'cv' });

        expect(Object.keys(result.sections).sort()).toEqual(
            ['cursos', 'educacion', 'experiencia_laboral', 'habilidades', 'idiomas', 'proyectos'].sort()
        );
    });
});
