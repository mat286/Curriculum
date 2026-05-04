import { describe, it, expect } from 'vitest';
import { IntentClassifierService } from '../modules/chat/IntentClassifierService.js';

const classifier = new IntentClassifierService();

describe('IntentClassifierService', () => {
    it('detecta intento de experiencia laboral', () => {
        const result = classifier.classify('¿cuáles son tus experiencias laborales?');
        expect(result.intent).toBe('work_experience');
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('detecta intento de educación', () => {
        const result = classifier.classify('¿dónde estudiaste?');
        expect(result.intent).toBe('education');
    });

    it('detecta intento de skills', () => {
        const result = classifier.classify('¿qué habilidades tenés?');
        expect(result.intent).toBe('skills');
    });

    it('detecta intento de tecnologías', () => {
        const result = classifier.classify('¿trabajás con React o Node?');
        expect(result.intent).toBe('technologies');
    });

    it('detecta intento de proyectos', () => {
        const result = classifier.classify('contame sobre tus proyectos');
        expect(result.intent).toBe('projects');
    });

    it('detecta intento de contacto', () => {
        const result = classifier.classify('¿cuál es tu email?');
        expect(result.intent).toBe('contact');
    });

    it('detecta intento de disponibilidad', () => {
        const result = classifier.classify('¿cuál es tu disponibilidad horaria?');
        expect(result.intent).toBe('availability');
    });

    it('devuelve general para preguntas sin match', () => {
        const result = classifier.classify('hola, cómo estás?');
        expect(result.intent).toBe('general');
        expect(result.confidence).toBe(0.6);
    });

    it('maneja string vacío', () => {
        const result = classifier.classify('');
        expect(result.intent).toBe('general');
    });

    it('maneja null', () => {
        const result = classifier.classify(null);
        expect(result.intent).toBe('general');
    });
});
