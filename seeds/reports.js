const mongoose = require('mongoose');
require('dotenv').config();

const Report = require('../models/report');
const User = require('../models/user');
const Store = require('../models/store');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/delivery-app';

const reasons = ['spam', 'inappropriate', 'other'];
const statuses = ['pending', 'reviewed', 'resolved'];

const descriptions = {
    spam: [
        'Esta tienda está enviando mensajes no solicitados',
        'Contenido repetitivo y no deseado en la descripción',
        'Productos duplicados con información spam',
        'La tienda está haciendo publicidad excesiva',
    ],
    inappropriate: [
        'Contenido ofensivo en la descripción de productos',
        'Imágenes inapropiadas en los productos',
        'Lenguaje inadecuado en el nombre de la tienda',
        'Productos que violan las políticas de la plataforma',
    ],
    other: [
        'La tienda no responde a los mensajes',
        'Información engañosa sobre los productos',
        'Precios sospechosamente bajos, posible estafa',
        'La tienda ha cerrado pero sigue apareciendo como activa',
        'Productos de mala calidad',
    ]
};

async function seedReports() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Obtener usuarios con role customer (serán los reportadores)
        const customers = await User.find({ role: 'customer' }).limit(10);
        if (customers.length === 0) {
            console.log('❌ No hay usuarios con role customer. Ejecuta el seeder de usuarios primero.');
            await mongoose.connection.close();
            return;
        }

        // Obtener tiendas para reportar
        const stores = await Store.find({}).limit(15);
        if (stores.length === 0) {
            console.log('❌ No hay tiendas. Ejecuta el seeder de tiendas primero.');
            await mongoose.connection.close();
            return;
        }

        console.log(`📊 Usuarios encontrados: ${customers.length}`);
        console.log(`📊 Tiendas encontradas: ${stores.length}`);

        // Limpiar reportes existentes
        await Report.deleteMany({});
        console.log('🗑️  Reportes anteriores eliminados');

        const reports = [];

        // Crear reportes variados
        const numberOfReports = Math.min(25, customers.length * 3);

        for (let i = 0; i < numberOfReports; i++) {
            const customer = customers[Math.floor(Math.random() * customers.length)];
            const store = stores[Math.floor(Math.random() * stores.length)];
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            // Seleccionar descripción según la razón
            const descriptionsList = descriptions[reason];
            const description = descriptionsList[Math.floor(Math.random() * descriptionsList.length)];

            // Verificar que no exista ya un reporte del mismo usuario para la misma tienda
            const existingReport = reports.find(
                r => r.reporterId.toString() === customer._id.toString() &&
                    r.storeId.toString() === store._id.toString()
            );

            if (!existingReport) {
                // Crear fecha aleatoria en los últimos 30 días
                const daysAgo = Math.floor(Math.random() * 30);
                const createdAt = new Date();
                createdAt.setDate(createdAt.getDate() - daysAgo);

                reports.push({
                    reporterId: customer._id,
                    storeId: store._id,
                    reason,
                    description,
                    status,
                    createdAt,
                    updatedAt: createdAt
                });
            }
        }

        // Insertar reportes
        await Report.insertMany(reports);

        console.log(`✅ ${reports.length} reportes creados exitosamente`);

        // Mostrar estadísticas
        const pendingCount = reports.filter(r => r.status === 'pending').length;
        const reviewedCount = reports.filter(r => r.status === 'reviewed').length;
        const resolvedCount = reports.filter(r => r.status === 'resolved').length;

        console.log('\n📊 Estadísticas de reportes:');
        console.log(`   - Pendientes: ${pendingCount}`);
        console.log(`   - Revisados: ${reviewedCount}`);
        console.log(`   - Resueltos: ${resolvedCount}`);

        const spamCount = reports.filter(r => r.reason === 'spam').length;
        const inappropriateCount = reports.filter(r => r.reason === 'inappropriate').length;
        const otherCount = reports.filter(r => r.reason === 'other').length;

        console.log('\n📋 Razones de reportes:');
        console.log(`   - Spam: ${spamCount}`);
        console.log(`   - Contenido inapropiado: ${inappropriateCount}`);
        console.log(`   - Otro: ${otherCount}`);

        await mongoose.connection.close();
        console.log('\n✅ Seeder completado y conexión cerrada');
    } catch (error) {
        console.error('❌ Error al ejecutar el seeder:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedReports();
