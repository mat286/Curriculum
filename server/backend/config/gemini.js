// ============================================================
// Configuración del proveedor Gemini
// Activo cuando: AI_PROVIDER=gemini (valor por defecto)
// ============================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_TIMEOUT = parseInt(process.env.GEMINI_TIMEOUT || '60000', 10);

export { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT };
