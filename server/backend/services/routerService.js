/**
 * @deprecated Este servicio fue eliminado en la auditoría técnica (2026-06).
 * Era el único consumidor de routerService (Flujo A), reemplazado por
 * IntentClassifierService en ChatOrchestrator.
 *
 * Mantener el archivo evita errores de importación en tests heredados.
 * Puede ser eliminado cuando los tests sean actualizados.
 */
export default {};
export const route = () => ({ needs_db: true, fields_required: [] });
