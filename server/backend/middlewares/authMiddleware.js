import { verificarToken } from '../utils/jwt.js';

export function autenticarUsuario(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Token no proporcionado',
            message: 'Debe incluir un token en el header Authorization (Bearer <token>)',
        });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token vacío' });
    }

    const userData = verificarToken(token);
    if (!userData) {
        return res.status(401).json({
            error: 'Token inválido o expirado',
            message: 'El token proporcionado no es válido o ha expirado',
        });
    }

    req.user = userData;
    next();
}
