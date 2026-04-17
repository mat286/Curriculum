import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';
import { indexUserData } from '../services/embeddingService.js';
import logger from '../utils/logger.js';

async function main() {
    const args = process.argv.slice(2);
    const userFlagIndex = args.indexOf('--user');

    try {
        if (userFlagIndex !== -1 && args[userFlagIndex + 1]) {
            // Indexar un usuario específico
            const userId = parseInt(args[userFlagIndex + 1], 10);
            if (isNaN(userId) || userId <= 0) {
                console.error('ID de usuario inválido');
                process.exit(1);
            }

            logger.info({ userId }, 'Indexando usuario...');
            const ok = await indexUserData(userId);
            logger.info({ userId, success: ok }, ok ? 'Indexación completada' : 'Sin datos para indexar');
        } else {
            // Indexar todos los usuarios
            const [users] = await pool.query('SELECT id, nombre, apellido FROM usuarios');
            logger.info({ count: users.length }, 'Indexando todos los usuarios...');

            let success = 0;
            for (const user of users) {
                const ok = await indexUserData(user.id);
                if (ok) success++;
                logger.info({ userId: user.id, nombre: `${user.nombre} ${user.apellido}`, success: ok }, 'Usuario procesado');
            }

            logger.info({ total: users.length, indexed: success }, 'Indexación masiva completada');
            logger.info('Colección global all_candidates actualizada (cada indexUserData ya hace upsert global)');
        }
    } catch (error) {
        logger.error({ err: error }, 'Error durante indexación');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
