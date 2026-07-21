import { GITHUB_API_URL, GITHUB_TOKEN } from '../config/github.js';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';

const MAX_PROJECTS = 6;
const MAX_SKILLS = 12;
const GITHUB_TIMEOUT_MS = 8000;
const GITHUB_RETRY_ATTEMPTS = 2;

function buildHeaders() {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'entrevista-virtual-app',
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    return headers;
}

async function fetchGithubJsonOnce(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(`${GITHUB_API_URL}${path}`, { headers: buildHeaders(), signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }

    if (response.status === 404) {
        throw new NotFoundError('No encontramos ese usuario en GitHub');
    }
    if (response.status === 403) {
        throw new ValidationError('GitHub limitó las solicitudes por ahora, probá de nuevo en unos minutos');
    }
    if (!response.ok) {
        throw new ValidationError('No se pudo consultar GitHub, probá de nuevo más tarde');
    }

    return response.json();
}

// GitHub a veces corta la conexión en el primer intento (visto en producción:
// ECONNRESET en la primera llamada, éxito en la segunda) — un solo reintento
// alcanza para esos casos transitorios sin castigar demasiado la latencia.
async function fetchGithubJson(path) {
    let lastError;
    for (let attempt = 1; attempt <= GITHUB_RETRY_ATTEMPTS; attempt++) {
        try {
            return await fetchGithubJsonOnce(path);
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
            lastError = error;
            logger.warn({ err: error, path, attempt }, 'Falló la consulta a GitHub, reintentando si corresponde');
        }
    }

    if (lastError?.name === 'AbortError') {
        throw new ValidationError('GitHub tardó demasiado en responder, probá de nuevo');
    }
    throw new ValidationError('No se pudo conectar con GitHub, probá de nuevo en un momento');
}

function buildProjectsFromRepos(repos) {
    return repos
        .filter((repo) => !repo.fork)
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, MAX_PROJECTS)
        .map((repo) => ({
            nombre: repo.name,
            descripcion: repo.description || '',
            tecnologias: repo.language || '',
            url: repo.html_url,
        }));
}

function buildSkillsFromRepos(repos) {
    const languages = new Set();
    for (const repo of repos) {
        if (repo.language) languages.add(repo.language);
    }
    return [...languages]
        .slice(0, MAX_SKILLS)
        .map((nombre) => ({ nombre, categoria: 'Lenguaje de programación' }));
}

function hasExistingBio(existingProfile) {
    const rows = existingProfile?.sobre_mi;
    return Array.isArray(rows) && rows.some((row) => row?.descripcion?.trim());
}

/**
 * Trae datos públicos de GitHub (bio, repos, lenguajes) por username y arma
 * una propuesta con la misma forma que profileExtractionService
 * (candidateFields + sections), para reusar ProfileUpdateConfirmCard tal
 * cual. No persiste nada — la confirmación la hace confirmProfileUpdates.
 */
export async function buildGithubImportProposal({ username, existingProfile = null }) {
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername) {
        throw new ValidationError('Ingresá tu username de GitHub');
    }

    const [user, repos] = await Promise.all([
        fetchGithubJson(`/users/${encodeURIComponent(cleanUsername)}`),
        fetchGithubJson(`/users/${encodeURIComponent(cleanUsername)}/repos?sort=pushed&per_page=30`),
    ]);

    const candidateFields = {
        githubUrl: user.html_url || `https://github.com/${cleanUsername}`,
    };
    if (user.bio && !hasExistingBio(existingProfile)) {
        candidateFields.sobreMi = user.bio.trim();
    }

    const reposList = Array.isArray(repos) ? repos : [];

    return {
        candidateFields,
        sections: {
            proyectos: buildProjectsFromRepos(reposList),
            habilidades: buildSkillsFromRepos(reposList),
        },
    };
}
