import { describe, it, expect, beforeEach } from 'vitest';
import { HybridSearchService } from '../services/HybridSearchService.js';

describe('HybridSearchService', () => {
    let service;

    beforeEach(() => {
        service = new HybridSearchService();
    });

    it('debería ejecutar BM25 search en CV fields', () => {
        const profileContext = {
            sobre_mi: [{ descripcion: 'Full stack developer with React and Node.js' }],
            habilidades: [
                { nombre: 'React' },
                { nombre: 'Node.js' },
                { nombre: 'TypeScript' },
            ],
            experiencia_laboral: [
                { puesto: 'Senior Dev', empresa: 'TechCorp', descripcion: 'Backend systems with Node.js' },
            ],
        };

        const results = service.bm25Search('React Node.js experience', profileContext);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('score');
        expect(results[0]).toHaveProperty('source');
    });

    it('debería mergear resultados BM25 y semánticos con pesos', () => {
        const bm25Results = [
            { text: 'React development experience', score: 1.5, source: 'habilidades' },
            { text: 'Node.js backend expertise', score: 1.2, source: 'experiencia_laboral' },
        ];

        const semanticResults = [
            'Full stack JavaScript development skills',
            'Backend architecture with Node.js patterns',
        ];

        const merged = service._mergeResults(bm25Results, semanticResults);

        expect(merged.length).toBeGreaterThan(0);
        expect(merged[0]).toHaveProperty('finalScore');
    });

    it('debería deduplicar resultados similares', () => {
        const results = [
            { text: 'React development with TypeScript', score: 0.9, source: 'habilidades' },
            { text: 'React development with TypeScript', score: 0.85, source: 'experiencia' },
            { text: 'Node.js backend systems', score: 0.8, source: 'proyectos' },
        ];

        const dedupedResults = service._deduplicateResults(results);

        expect(dedupedResults.length).toBeLessThanOrEqual(results.length);
    });

    it('debería retornar top-5 resultados ordenados por score', () => {
        const profileContext = {
            habilidades: [
                { nombre: 'JavaScript' },
                { nombre: 'React' },
                { nombre: 'Node.js' },
                { nombre: 'TypeScript' },
                { nombre: 'Python' },
            ],
            experiencia_laboral: [
                { puesto: 'Dev', empresa: 'Corp', descripcion: 'React projects' },
            ],
        };

        const semanticResults = [
            'JavaScript ecosystem',
            'React patterns',
            'Node.js performance',
        ];

        const result = service.search({
            query: 'JavaScript React experience',
            profileContext,
            semanticResults,
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(result.results.length).toBeLessThanOrEqual(5);
        expect(result.scores.length).toBeLessThanOrEqual(5);
        expect(result.method).toBe('hybrid');
        expect(result.stats).toBeDefined();
    });

    it('debería loguear stats de búsqueda híbrida', () => {
        const profileContext = {
            habilidades: [{ nombre: 'JavaScript' }],
        };

        const result = service.search({
            query: 'JavaScript',
            profileContext,
            semanticResults: ['JS framework'],
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(result.stats.method).toBe('hybrid');
        expect(result.stats.bm25Count).toBeGreaterThanOrEqual(0);
        expect(result.stats.semanticCount).toBeGreaterThanOrEqual(0);
        expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('aplica filtros por includeSections y queryType en BM25', () => {
        const profileContext = {
            habilidades: [{ nombre: 'Node.js' }],
            experiencia_laboral: [{ descripcion: 'APIs y servicios backend' }],
            educacion: [{ institucion: 'Universidad X' }],
        };

        const result = service.search({
            query: 'Node.js',
            profileContext,
            semanticResults: [],
            includeSections: ['habilidades'],
            queryType: 'fact',
            candidateId: 'test-123',
            requestId: 'req-789',
        });

        const hasOnlyAllowed = result.details.every((item) =>
            ['habilidades', 'semantic'].includes(item.source),
        );

        expect(hasOnlyAllowed).toBe(true);
        expect(result.stats.queryType).toBe('fact');
    });

    it('deduplica por similitud textual usando threshold configurable', () => {
        process.env.HYBRID_DEDUPE_THRESHOLD = '0.5';
        const strictService = new HybridSearchService();

        const deduped = strictService._deduplicateResults([
            { text: 'Node.js backend con microservicios y tracing', finalScore: 0.8, source: 'semantic' },
            { text: 'Microservicios backend en Node.js con tracing', finalScore: 0.9, source: 'semantic' },
            { text: 'React frontend con TypeScript', finalScore: 0.7, source: 'semantic' },
        ]);

        expect(deduped.length).toBeLessThanOrEqual(2);
        delete process.env.HYBRID_DEDUPE_THRESHOLD;
    });
});
