import { describe, it, expect } from 'vitest';
import { ContextSelectorService } from '../modules/chat/ContextSelectorService.js';

const selector = new ContextSelectorService();

describe('ContextSelectorService.select', () => {
    it('no recorta por debajo del set base del intent aunque la confianza sea alta y la pregunta corta', () => {
        // 'technologies' mapea a 3 secciones; antes del fix, alta confianza + pregunta
        // corta las recortaba a 2, perdiendo 'experiencia_laboral'.
        const result = selector.select('technologies', 0.92, 'que tecnologias usas');

        expect(result.include).toEqual(
            expect.arrayContaining(['habilidades', 'proyectos', 'experiencia_laboral']),
        );
    });

    it('amplía con sobre_mi cuando la confianza es baja', () => {
        const result = selector.select('education', 0.5, 'contame sobre tu formacion academica y demas');

        expect(result.include).toContain('sobre_mi');
        expect(result.include).toContain('educacion');
    });
});
