/**
 * profileNormalizers.js
 * Funciones de normalización de datos de perfil compartidas entre páginas de chat.
 */

export const toText = (value) =>
    value === null || typeof value === "undefined" ? "" : String(value);

export const toBoolean = (value) =>
    value === true || value === 1 || value === "1" || value === "true";

/**
 * Normaliza un array de items de sección de perfil a un formato uniforme.
 * Soporta strings simples (se mapean a { titulo }) y objetos ricos.
 */
export const normalizeProfileItems = (items) => {
    if (!Array.isArray(items)) return [];

    return items.map((item, index) => {
        if (typeof item === "string") {
            return { id: `item-${index}`, titulo: item };
        }

        return {
            id: item?.id ?? `item-${index}`,
            titulo: toText(
                item?.titulo || item?.nombre || item?.idioma || item?.puesto || item?.empresa || item?.institucion
            ),
            descripcion: toText(
                item?.descripcion || item?.detalle || item?.nivel || item?.categoria || item?.tecnologias
            ),
            organizacion: toText(item?.organizacion || item?.empresa || item?.institucion || item?.entidad),
            ubicacion: toText(item?.ubicacion || item?.location),
            fechaInicio: toText(item?.fechaInicio || item?.fecha_inicio || item?.desde).slice(0, 7),
            fechaFin: toText(item?.fechaFin || item?.fecha_fin || item?.hasta).slice(0, 7),
            enCurso: toBoolean(item?.enCurso ?? item?.en_curso ?? item?.actual),
            enlace: toText(item?.enlace || item?.url || item?.link || item?.github || item?.demo_url),
            nivel: toText(item?.nivel || item?.level),
            categoria: toText(item?.categoria || item?.category),
            rol: toText(item?.rol),
            tags: Array.isArray(item?.tags) ? item.tags : [],
        };
    });
};

/**
 * Normaliza items de tipo tag (habilidades, idiomas) — versión reducida.
 */
export const normalizeTagItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item, index) => {
            if (typeof item === "string") return { id: `tag-${index}`, titulo: item };
            return {
                id: item?.id ?? `tag-${index}`,
                titulo: toText(item?.titulo || item?.nombre || item?.idioma || item?.skill || item?.habilidad),
                nivel: toText(item?.nivel || item?.level),
            };
        })
        .filter((item) => item.titulo);
};

/**
 * Normaliza perfil del owner (Chat.jsx / Flujo A).
 * data: respuesta de userService.getProfile()
 * fallbackUser: objeto user del AuthContext
 */
export const normalizeOwnerProfile = (data = {}, fallbackUser = {}) => {
    const about = Array.isArray(data.sobre_mi) ? data.sobre_mi[0] || {} : data.sobre_mi || {};
    const fullName =
        [data.usuario?.nombre || fallbackUser?.nombre, data.usuario?.apellido || fallbackUser?.apellido]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        fallbackUser?.email?.split("@")[0] ||
        "Perfil profesional";

    return {
        name: fullName,
        headline: toText(data.usuario?.resumen || data.usuario?.puesto_actual || fallbackUser?.puesto || "CV conversacional activo"),
        summary: toText(
            about.descripcion ||
            data.usuario?.objetivo_profesional ||
            data.usuario?.resumen ||
            fallbackUser?.resumen ||
            "Completa tu perfil para que la IA entregue respuestas más ricas y útiles."
        ),
        location: toText(data.usuario?.direccion || fallbackUser?.direccion),
        availability: toText(data.usuario?.disponibilidad),
        preferredMode: toText(data.usuario?.modalidad_preferida),
        salary: toText(data.usuario?.pretension_salarial),
        linkedinUrl: toText(data.usuario?.linkedin_url),
        githubUrl: toText(data.usuario?.github_url),
        portfolioUrl: toText(data.usuario?.portfolio_url),
        experiences: normalizeProfileItems(data.experiencia_laboral),
        projects: normalizeProfileItems(data.proyectos),
        skills: normalizeProfileItems(data.habilidades),
        studies: normalizeProfileItems(data.educacion),
        languages: normalizeProfileItems(data.idiomas),
    };
};

/**
 * Normaliza perfil de candidato público (CandidateChatPage.jsx / Flujo B).
 * candidate: objeto de la lista pública
 * data: respuesta de userService.getProfile(candidateId)
 */
export const normalizeCandidateProfile = (candidate = {}, data = {}) => {
    const about = Array.isArray(data.sobre_mi) ? data.sobre_mi[0] || {} : data.sobre_mi || {};
    const fullName =
        toText(candidate.nombre) ||
        [data.usuario?.nombre, data.usuario?.apellido].filter(Boolean).join(" ").trim() ||
        "Candidato";

    return {
        name: fullName,
        headline: toText(candidate.puestoActual || data.usuario?.puesto_actual || data.usuario?.resumen || "Perfil conversacional activo"),
        summary: toText(
            candidate.resumen ||
            about.descripcion ||
            data.usuario?.objetivo_profesional ||
            data.usuario?.resumen ||
            "Perfil listo para conversar y ser evaluado por IA."
        ),
        location: toText(candidate.ubicacion || data.usuario?.direccion),
        availability: toText(data.usuario?.disponibilidad),
        preferredMode: toText(data.usuario?.modalidad_preferida),
        salary: toText(data.usuario?.pretension_salarial),
        linkedinUrl: toText(data.usuario?.linkedin_url || candidate.linkedin_url || candidate.linkedinUrl),
        githubUrl: toText(data.usuario?.github_url || candidate.github_url || candidate.githubUrl),
        portfolioUrl: toText(data.usuario?.portfolio_url || candidate.portfolio_url || candidate.portfolioUrl),
        experiences: normalizeProfileItems(data.experiencia_laboral || candidate.experiencia_laboral || candidate.experiencias || []),
        projects: normalizeProfileItems(data.proyectos || candidate.proyectos || candidate.projects || []),
        skills: normalizeTagItems(data.habilidades || candidate.habilidades || candidate.skills || []),
        studies: normalizeProfileItems(data.educacion || candidate.estudios || candidate.educacion || []),
        languages: normalizeTagItems(data.idiomas || candidate.idiomas || candidate.languages || []),
    };
};
