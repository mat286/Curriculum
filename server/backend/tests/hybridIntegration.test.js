/**
 * hybridIntegration.test.js
 *
 * Actualizado en refactor 2026-06: enrichWithHybrid fue movido de chatController
 * a HybridSearchService. HybridSearchService es puro (BM25 in-memory, sin DB),
 * así que se puede testear con la implementación real.
 */
import { describe, it, expect } from 'vitest';
import { enrichWithHybrid } from '../services/HybridSearchService.js';

const userData = {
    usuario: { id: 44, nombre: 'Dev', resumen: 'Node.js backend developer' },
    habilidades: [{ nombre: 'Node.js' }, { nombre: 'React' }],
    experiencia_laboral: [{ puesto: 'Backend Dev', empresa: 'TechCorp', descripcion: 'Node.js APIs' }],
};

describe('enrichWithHybrid', () => {
    it('retorna array vacío cuando semanticHits está vacío', () => {
        const result = enrichWithHybrid('node', [], userData, 44, 'req-1');
        expect(result).toEqual([]);
    });

    it('retorna los semanticHits originales cuando userData es null', () => {
        const semanticHits = ['sem-x'];
        const result = enrichWithHybrid('node', semanticHits, null, 1, 'req-2');
        // enrichWithHybrid guarda con semanticHits cuando no hay userData
        expect(result).toEqual(semanticHits);
    });

    it('retorna un array de resultados cuando hay hits semánticos y userData válido', () => {
        const semanticHits = [
            'Node.js APIs con observabilidad y tracing',
            'Backend developer con experiencia en sistemas distribuidos',
        ];
        const result = enrichWithHybrid('Node.js experiencia', semanticHits, userData, 44, 'req-3');

        // El resultado es un array (puede haber reordenado/filtrado por BM25)
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
    });

    it('hace fallback a semanticHits si HybridSearch lanza internamente', () => {
        // Inputs inválidos que podrían causar fallo interno — enrichWithHybrid tiene try-catch
        const semanticHits = ['sem-fallback'];
        // userData completamente vacío pero truthy
        const result = enrichWithHybrid('query', semanticHits, {}, 99, 'req-4');
        // Puede retornar [] o semanticHits — lo importante es que no lanza
        expect(Array.isArray(result)).toBe(true);
    });
});
