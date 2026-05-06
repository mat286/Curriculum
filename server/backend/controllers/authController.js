import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { generarAccessToken, generarRefreshToken, REFRESH_TOKEN_EXPIRY_DAYS, verificarToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function buildRefreshTokenExpiryDate() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return expiresAt;
}

export async function loginWithGoogle(req, res, next) {
    try {
        if (!client) {
            return res.status(500).json({ error: 'Configuración de Google OAuth no disponible' });
        }

        const { credential } = req.body;
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({ error: 'Credencial de Google no proporcionada' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.email) {
            return res.status(401).json({ error: 'Token de Google inválido' });
        }
        if (!payload.email_verified) {
            return res.status(401).json({ error: 'El email de Google no está verificado' });
        }

        const { email, given_name, family_name } = payload;

        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        let userId, user;

        if (rows.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO usuarios (nombre, apellido, email) VALUES (?, ?, ?)',
                [given_name || '', family_name || '', email]
            );
            userId = result.insertId;
            user = {
                id: userId,
                nombre: given_name || '',
                apellido: family_name || '',
                email,
                role: 'candidate',
                onboarding_step: 1,
                onboarding_completed: 0,
                is_public: 0,
            };
            logger.info({ userId, email }, 'Nuevo usuario creado');
        } else {
            userId = rows[0].id;
            user = {
                id: userId,
                nombre: rows[0].nombre || given_name || '',
                apellido: rows[0].apellido || family_name || '',
                email: rows[0].email,
                role: rows[0].role || 'candidate',
                onboarding_step: rows[0].onboarding_step ?? 1,
                onboarding_completed: rows[0].onboarding_completed ?? 0,
                is_public: rows[0].is_public ?? 0,
            };
        }

        const token = generarAccessToken({ id: userId, email, nombre: user.nombre, apellido: user.apellido, role: user.role });
        const { token: refreshToken, tokenHash } = generarRefreshToken();
        const expiresAt = buildRefreshTokenExpiryDate();
        const deviceHint = req.headers['user-agent']?.substring(0, 255) || null;

        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_hint) VALUES (?, ?, ?, ?)',
            [userId, tokenHash, expiresAt, deviceHint]
        );

        logger.info({ userId, expiresAt }, 'Refresh token emitido en login');

        res.json({ success: true, token, refreshToken, user });
    } catch (err) {
        if (err.message?.includes('Token used too early')) {
            return res.status(401).json({ error: 'Token de Google expirado o usado prematuramente' });
        }
        next(err);
    }
}

export async function refreshToken(req, res, next) {
    try {
        const { refreshToken: currentRefreshToken } = req.body || {};

        if (!currentRefreshToken || typeof currentRefreshToken !== 'string') {
            return res.status(400).json({ error: 'Refresh token no proporcionado' });
        }

        const currentTokenHash = crypto.createHash('sha256').update(currentRefreshToken).digest('hex');

        const [rows] = await pool.query(
            `SELECT rt.id, rt.user_id, u.email, u.role
             FROM refresh_tokens rt
             INNER JOIN usuarios u ON u.id = rt.user_id
             WHERE rt.token_hash = ?
               AND rt.expires_at > NOW()
               AND rt.revoked_at IS NULL
             LIMIT 1`,
            [currentTokenHash]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Refresh token inválido o expirado' });
        }

        const tokenRow = rows[0];
        const newAccessToken = generarAccessToken({ id: tokenRow.user_id, email: tokenRow.email, role: tokenRow.role || 'candidate' });
        const { token: newRefreshToken, tokenHash: newTokenHash } = generarRefreshToken();
        const expiresAt = buildRefreshTokenExpiryDate();
        const deviceHint = req.headers['user-agent']?.substring(0, 255) || null;

        await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [tokenRow.id]);
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_hint) VALUES (?, ?, ?, ?)',
            [tokenRow.user_id, newTokenHash, expiresAt, deviceHint]
        );

        logger.info({ userId: tokenRow.user_id, oldTokenId: tokenRow.id, expiresAt }, 'Refresh token rotado correctamente');

        res.json({
            token: newAccessToken,
            refreshToken: newRefreshToken,
            user: { id: tokenRow.user_id, email: tokenRow.email },
        });
    } catch (err) {
        next(err);
    }
}

export async function logout(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';

        if (!authHeader.startsWith('Bearer ')) {
            return res.json({ success: true });
        }

        const token = authHeader.slice(7);
        const payload = verificarToken(token);
        const userId = payload?.id;

        if (!userId) {
            return res.json({ success: true });
        }

        await pool.query(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
            [userId]
        );

        logger.info({ userId }, 'Logout exitoso con revocación de refresh tokens');

        return res.json({ success: true });
    } catch (err) {
        logger.warn({ err }, 'No se pudo extraer userId desde Authorization en logout');
        return res.json({ success: true });
    }
}
