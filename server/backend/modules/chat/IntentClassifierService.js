const RULES = [
    { intent: 'technologies', confidence: 0.92, re: /(tecnologia|framework|libreria|node\.js|react|python|java(?!script)|sql|aws|docker|kubernetes)/i },
    { intent: 'work_experience', confidence: 0.92, re: /(experiencia|trabaj|empresa|rol|puesto|career|trayectoria)/i },
    { intent: 'education', confidence: 0.92, re: /(educacion|estudi|universidad|instituto|titulo|carrera|formacion)/i },
    { intent: 'skills', confidence: 0.9, re: /(habilidad|skill|competencia|stack|fortaleza)/i },
    { intent: 'projects', confidence: 0.9, re: /(proyecto|portfolio|portafolio|caso|implement)/i },
    { intent: 'languages', confidence: 0.9, re: /(idioma|ingles|ingles|espanol|español|frances|portugues|nivel de idioma)/i },
    { intent: 'contact', confidence: 0.94, re: /(contacto|email|correo|telefono|tel|llamar|whatsapp|ubicacion|direccion)/i },
    { intent: 'social', confidence: 0.9, re: /(linkedin|github|portfolio|red social|sitio web)/i },
    { intent: 'availability', confidence: 0.88, re: /(disponibilidad|horario|jornada|modalidad|remoto|hibrido|salario|pretension)/i },
    { intent: 'summary', confidence: 0.85, re: /(resumen|perfil|quien eres|presentate|presentación|sobre ti)/i },
    { intent: 'faq_candidate', confidence: 0.8, re: /(pregunta frecuente|faq|frecuente)/i },
    { intent: 'personal', confidence: 0.78, re: /(familia|estado civil|hijos|nacionalidad|edad)/i },
];

export class IntentClassifierService {
    classify(question) {
        const text = question || '';
        const match = RULES.find((rule) => rule.re.test(text));
        if (!match) {
            return { intent: 'general', confidence: 0.6 };
        }
        return { intent: match.intent, confidence: match.confidence };
    }
}
