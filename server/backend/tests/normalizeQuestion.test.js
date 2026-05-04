import { describe, it, expect } from 'vitest';
import { NormalizeQuestionService } from '../modules/chat/NormalizeQuestionService.js';

const svc = new NormalizeQuestionService();

describe('NormalizeQuestionService', () => {
    it('convierte a minúsculas', () => {
        expect(svc.normalize('Hola MUNDO')).toBe('hola mundo');
    });

    it('elimina acentos (NFD)', () => {
        expect(svc.normalize('¿Cuál es tu experiéncia?')).toBe('¿cual es tu experiencia?');
    });

    it('colapsa espacios múltiples', () => {
        expect(svc.normalize('hola    mundo')).toBe('hola mundo');
    });

    it('elimina espacios al inicio y al final', () => {
        expect(svc.normalize('  hola  ')).toBe('hola');
    });

    it('maneja un string vacío', () => {
        expect(svc.normalize('')).toBe('');
    });

    it('maneja null devolviendo string vacío', () => {
        expect(svc.normalize(null)).toBe('');
    });

    it('maneja undefined devolviendo string vacío', () => {
        expect(svc.normalize(undefined)).toBe('');
    });

    it('maneja valores numéricos', () => {
        expect(svc.normalize(42)).toBe('');
    });
});
