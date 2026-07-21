import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { buildGithubImportProposal } from '../services/githubImportService.js';

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    };
}

describe('githubImportService.buildGithubImportProposal', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('lanza ValidationError si no se pasa username', async () => {
        await expect(buildGithubImportProposal({ username: '  ' })).rejects.toMatchObject({ statusCode: 400 });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si el usuario no existe en GitHub (404)', async () => {
        global.fetch.mockResolvedValue(jsonResponse(404, {}));

        await expect(buildGithubImportProposal({ username: 'noexiste' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('lanza error claro cuando GitHub rate-limitea (403)', async () => {
        global.fetch.mockResolvedValue(jsonResponse(403, {}));

        await expect(buildGithubImportProposal({ username: 'alguien' })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('arma candidateFields y sections a partir de bio + repos', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/repos')) {
                return Promise.resolve(jsonResponse(200, [
                    { name: 'proyecto-estrella', description: 'El mejor', language: 'JavaScript', html_url: 'https://github.com/x/proyecto-estrella', stargazers_count: 40, fork: false },
                    { name: 'un-fork', description: 'no cuenta', language: 'Python', html_url: 'https://github.com/x/un-fork', stargazers_count: 999, fork: true },
                    { name: 'otro-repo', description: '', language: 'Python', html_url: 'https://github.com/x/otro-repo', stargazers_count: 2, fork: false },
                ]));
            }
            return Promise.resolve(jsonResponse(200, {
                html_url: 'https://github.com/devana',
                bio: 'Backend developer apasionada por Node.js',
            }));
        });

        const proposal = await buildGithubImportProposal({ username: 'devana', existingProfile: { sobre_mi: [] } });

        expect(proposal.candidateFields).toEqual({
            githubUrl: 'https://github.com/devana',
            sobreMi: 'Backend developer apasionada por Node.js',
        });
        expect(proposal.sections.proyectos).toEqual([
            { nombre: 'proyecto-estrella', descripcion: 'El mejor', tecnologias: 'JavaScript', url: 'https://github.com/x/proyecto-estrella' },
            { nombre: 'otro-repo', descripcion: '', tecnologias: 'Python', url: 'https://github.com/x/otro-repo' },
        ]);
        expect(proposal.sections.habilidades).toEqual(
            expect.arrayContaining([
                { nombre: 'JavaScript', categoria: 'Lenguaje de programación' },
                { nombre: 'Python', categoria: 'Lenguaje de programación' },
            ]),
        );
    });

    it('no propone sobreMi si el candidato ya tiene una descripción propia', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/repos')) return Promise.resolve(jsonResponse(200, []));
            return Promise.resolve(jsonResponse(200, { html_url: 'https://github.com/devana', bio: 'Bio de GitHub' }));
        });

        const proposal = await buildGithubImportProposal({
            username: 'devana',
            existingProfile: { sobre_mi: [{ descripcion: 'Ya tengo mi propia bio' }] },
        });

        expect(proposal.candidateFields.sobreMi).toBeUndefined();
    });

    it('reintenta una vez si la conexión falla de forma transitoria (ej. ECONNRESET) y luego funciona', async () => {
        let userCallCount = 0;
        global.fetch.mockImplementation((url) => {
            if (url.includes('/repos')) return Promise.resolve(jsonResponse(200, []));
            userCallCount += 1;
            if (userCallCount === 1) return Promise.reject(new TypeError('fetch failed'));
            return Promise.resolve(jsonResponse(200, { html_url: 'https://github.com/devana', bio: null }));
        });

        const proposal = await buildGithubImportProposal({ username: 'devana' });

        expect(userCallCount).toBe(2);
        expect(proposal.candidateFields.githubUrl).toBe('https://github.com/devana');
    });

    it('da un error claro si la conexión sigue fallando después de reintentar', async () => {
        global.fetch.mockRejectedValue(new TypeError('fetch failed'));

        await expect(buildGithubImportProposal({ username: 'devana' })).rejects.toMatchObject({ statusCode: 400 });
    });
});
