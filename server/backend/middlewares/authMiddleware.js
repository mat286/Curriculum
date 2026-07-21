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

    // Compatibilidad con tokens legacy que no tienen role
    req.user = { ...userData, role: userData.role || 'candidate' };
    next();
}

// Autenticación opcional: si viene un Bearer token válido, resuelve req.user
// igual que autenticarUsuario; si no viene token o es inválido, deja
// req.user = null y sigue igual (NO responde 401). Para endpoints públicos
// (candidato con is_public=1, chat con un candidato) que además quieren saber
// quién es el visitante cuando SÍ está logueado, sin exigirle login.
export function autenticarUsuarioOpcional(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];
    const userData = token ? verificarToken(token) : null;
    req.user = userData ? { ...userData, role: userData.role || 'candidate' } : null;
    next();
}

export function requireRole(...roles) {
    return (req, res, next) => {
        const userRole = req.user?.role || 'candidate';
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                error: 'Acceso denegado',
                requiredRole: roles,
            });
        }
        next();
    };
}
