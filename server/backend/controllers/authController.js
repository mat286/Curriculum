import { OAuth2Client } from 'google-auth-library';
import { generarToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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

        const { email, given_name, family_name } = payload;

        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        let userId, user;

        if (rows.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO usuarios (nombre, apellido, email) VALUES (?, ?, ?)',
                [given_name || '', family_name || '', email]
            );
            userId = result.insertId;
            user = { id: userId, nombre: given_name || '', apellido: family_name || '', email };
            logger.info({ userId, email }, 'Nuevo usuario creado');
        } else {
            userId = rows[0].id;
            user = {
                id: userId,
                nombre: rows[0].nombre || given_name || '',
                apellido: rows[0].apellido || family_name || '',
                email: rows[0].email,
            };
        }

        const token = generarToken({ id: userId, email, nombre: user.nombre, apellido: user.apellido });

        res.json({ success: true, token, user });
    } catch (err) {
        if (err.message?.includes('Token used too early')) {
            return res.status(401).json({ error: 'Token de Google expirado o usado prematuramente' });
        }
        next(err);
    }
}
