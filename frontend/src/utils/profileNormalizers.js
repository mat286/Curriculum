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
