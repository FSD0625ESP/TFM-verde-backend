/*
 * Script de desarrollo: activa todas las tiendas.
 *
 * Uso:
 *   npm run stores:activate
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/store');

const isDev = (process.env.NODE_ENV || '').toLowerCase() === 'development';
const force = process.argv.includes('--force');

const main = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('Falta MONGO_URI en el entorno');
    }

    if (!isDev && !force) {
        throw new Error('Este script es sólo para desarrollo. Usa NODE_ENV=development o ejecuta con --force.');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const filter = {
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    const update = {
        $set: { active: true },
    };

    const result = await Store.updateMany(filter, update);

    // mongoose@8 devuelve acknowledged/matchedCount/modifiedCount
    const matched = result?.matchedCount ?? result?.n ?? 0;
    const modified = result?.modifiedCount ?? result?.nModified ?? 0;

    console.log(`✅ Tiendas activadas. Matched: ${matched}, Modified: ${modified}`);
};

main()
    .catch((err) => {
        console.error('❌ Error activando tiendas:', err.message || err);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await mongoose.connection.close();
        } catch (_) {
            // noop
        }
    });

