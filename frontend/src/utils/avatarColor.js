// Paleta fija de gradientes (misma familia tonal del sistema — grises oscuros
// + un acento) para generar un avatar consistente a partir del nombre, en vez
// de un círculo gris liso. Determinístico: el mismo nombre siempre da el mismo color.
const GRADIENTS = [
    "linear-gradient(135deg, #111827 0%, #374151 100%)",
    "linear-gradient(135deg, #0F766E 0%, #134E4A 100%)",
    "linear-gradient(135deg, #4338CA 0%, #312E81 100%)",
    "linear-gradient(135deg, #B45309 0%, #78350F 100%)",
    "linear-gradient(135deg, #047857 0%, #064E3B 100%)",
    "linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%)",
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

/** Gradiente determinístico para el avatar de iniciales de `name`. */
export function avatarGradient(name = "") {
    const key = name.trim() || "?";
    const index = hashString(key) % GRADIENTS.length;
    return GRADIENTS[index];
}
