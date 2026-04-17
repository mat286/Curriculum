import jwt from 'jsonwebtoken';
import logger from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    logger.warn('JWT_SECRET no está definido en las variables de entorno');
}

export function generarToken(payload) {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET no está configurado');
    }
    if (!payload || typeof payload !== 'object') {
        throw new Error('El payload debe ser un objeto');
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verificarToken(token) {
    if (!JWT_SECRET || !token || typeof token !== 'string') {
        return null;
    }
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            logger.debug('Token expirado');
        } else {
            logger.debug('Token inválido');
        }
        return null;
    }
}
