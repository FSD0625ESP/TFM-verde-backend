const mongoose = require("mongoose");
const Analytics = require("../models/analytics");
const Store = require("../models/store");
const Product = require("../models/product");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
console.log("MONGODB_URI:", MONGO_URI);

// Configuración de probabilidades y volúmenes
const CONFIG = {
    // Días hacia atrás para generar datos
    daysBack: 90,
    // Eventos por día (rango)
    eventsPerDay: { min: 50, max: 200 },
    // Distribución de tipos de evento (porcentajes)
    eventDistribution: {
        view_store: 40,
        view_product: 45,
        add_to_cart: 12,
        purchase: 3,
    },
    // Distribución de dispositivos (porcentajes)
    deviceDistribution: {
        desktop: 55,
        mobile: 38,
        tablet: 7,
    },
    // Navegadores y sus user agents
    browsers: [
        { name: "Chrome", weight: 60, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        { name: "Firefox", weight: 15, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0" },
        { name: "Safari", weight: 18, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15" },
        { name: "Edge", weight: 7, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0" },
    ],
    // Referrers comunes
    referrers: [
        { url: "https://www.google.com/", weight: 45 },
        { url: "https://www.facebook.com/", weight: 15 },
        { url: "https://www.instagram.com/", weight: 12 },
        { url: "", weight: 20 }, // Directo
        { url: "https://twitter.com/", weight: 5 },
        { url: "https://www.pinterest.com/", weight: 3 },
    ],
    // Número de sesiones únicas a generar
    uniqueSessions: 500,
};

// Generar UUID para sessionId
const generateUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// Selección ponderada aleatoria
const weightedRandom = (items, weightKey = "weight") => {
    const totalWeight = items.reduce((sum, item) => sum + item[weightKey], 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= item[weightKey];
        if (random <= 0) return item;
    }
    return items[items.length - 1];
};

// Obtener tipo de evento según distribución
const getEventType = () => {
    const items = Object.entries(CONFIG.eventDistribution).map(([type, weight]) => ({
        type,
        weight,
    }));
    return weightedRandom(items).type;
};

// Obtener dispositivo según distribución
const getDevice = () => {
    const items = Object.entries(CONFIG.deviceDistribution).map(([device, weight]) => ({
        device,
        weight,
    }));
    return weightedRandom(items).device;
};

// Generar fecha aleatoria dentro de un día específico
const getRandomTimeInDay = (date) => {
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);

    const newDate = new Date(date);
    newDate.setHours(hour, minute, second, 0);
    return newDate;
};

// Crear sesiones de usuario simuladas
const generateSessions = (storeId, products) => {
    const sessions = [];

    for (let i = 0; i < CONFIG.uniqueSessions; i++) {
        const sessionId = generateUUID();
        const browser = weightedRandom(CONFIG.browsers);
        const device = getDevice();
        const referrer = weightedRandom(CONFIG.referrers);

        // Cada sesión tiene productos favoritos (simula comportamiento real)
        const favoriteProducts = products
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.floor(Math.random() * 5) + 1);

        sessions.push({
            sessionId,
            browser,
            device,
            referrer: referrer.url,
            favoriteProducts,
            // Probabilidad de que esta sesión sea "activa" (más eventos)
            activityLevel: Math.random(),
        });
    }

    return sessions;
};

// Generar eventos de analytics
const generateAnalyticsEvents = async (store, products, sessions) => {
    const events = [];
    const now = new Date();

    for (let daysAgo = 0; daysAgo < CONFIG.daysBack; daysAgo++) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(0, 0, 0, 0);

        // Más eventos en días recientes, menos en días antiguos
        const recencyFactor = 1 - (daysAgo / CONFIG.daysBack) * 0.5;
        // Variación por día de la semana (más eventos en fines de semana)
        const dayOfWeek = date.getDay();
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;

        const baseEvents = CONFIG.eventsPerDay.min +
            Math.random() * (CONFIG.eventsPerDay.max - CONFIG.eventsPerDay.min);
        const numEvents = Math.floor(baseEvents * recencyFactor * weekendFactor);

        for (let i = 0; i < numEvents; i++) {
            // Seleccionar una sesión aleatoria (con preferencia por sesiones activas)
            const session = sessions[Math.floor(Math.random() * sessions.length)];

            // Determinar tipo de evento
            let eventType = getEventType();

            // Si no hay productos, solo generar view_store
            if (products.length === 0) {
                eventType = "view_store";
            }

            // Ajustar probabilidades basado en nivel de actividad de la sesión
            if (session.activityLevel < 0.3) {
                // Sesiones poco activas casi nunca compran
                if (eventType === "purchase") eventType = "view_product";
                if (eventType === "add_to_cart" && Math.random() > 0.3) eventType = "view_product";
            }

            // Si no hay productos y el evento requiere producto, cambiar a view_store
            if (products.length === 0 && ["view_product", "add_to_cart", "purchase"].includes(eventType)) {
                eventType = "view_store";
            }

            // Seleccionar producto si es necesario
            let productId = null;
            if (["view_product", "add_to_cart", "purchase"].includes(eventType) && products.length > 0) {
                // Preferir productos favoritos de la sesión
                if (Math.random() < 0.7 && session.favoriteProducts.length > 0) {
                    productId = session.favoriteProducts[Math.floor(Math.random() * session.favoriteProducts.length)]._id;
                } else {
                    productId = products[Math.floor(Math.random() * products.length)]._id;
                }
            }

            const event = {
                eventType,
                storeId: store._id,
                productId,
                sessionId: session.sessionId,
                userAgent: session.browser.ua,
                metadata: {
                    referrer: session.referrer,
                    device: session.device,
                    browser: session.browser.name,
                },
                createdAt: getRandomTimeInDay(date),
            };

            events.push(event);
        }
    }

    return events;
};

// Función principal del seeder
const seedAnalytics = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Conectado a MongoDB");

        // Obtener todas las tiendas
        const stores = await Store.find({});
        console.log(`📦 Encontradas ${stores.length} tiendas`);

        if (stores.length === 0) {
            console.log("❌ No hay tiendas. Ejecuta primero: npm run seed");
            process.exit(1);
        }

        // Limpiar analytics existentes
        const deleteResult = await Analytics.deleteMany({});
        console.log(`🗑️  Eliminados ${deleteResult.deletedCount} registros de analytics anteriores`);

        let totalEvents = 0;

        for (const store of stores) {
            console.log(`\n🏪 Procesando tienda: ${store.name}`);

            // Obtener productos de la tienda (usando storeId que es el campo correcto)
            const products = await Product.find({ storeId: store._id });
            console.log(`   📦 ${products.length} productos encontrados`);

            // Generar sesiones para esta tienda
            const sessions = generateSessions(store._id, products);
            console.log(`   👥 ${sessions.length} sesiones generadas`);

            // Generar eventos
            const events = await generateAnalyticsEvents(store, products, sessions);
            console.log(`   📊 ${events.length} eventos generados`);

            // Insertar en lotes de 1000
            const batchSize = 1000;
            for (let i = 0; i < events.length; i += batchSize) {
                const batch = events.slice(i, i + batchSize);
                await Analytics.insertMany(batch);
                process.stdout.write(`   💾 Insertados ${Math.min(i + batchSize, events.length)}/${events.length}\r`);
            }
            console.log(`   ✅ Completado`);

            totalEvents += events.length;
        }

        console.log(`\n🎉 Seeding completado!`);
        console.log(`   📊 Total de eventos creados: ${totalEvents.toLocaleString()}`);

        // Mostrar resumen de datos
        const summary = await Analytics.aggregate([
            {
                $group: {
                    _id: "$eventType",
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]);

        console.log("\n📈 Resumen por tipo de evento:");
        summary.forEach((item) => {
            console.log(`   ${item._id}: ${item.count.toLocaleString()}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Error en el seeding:", error);
        process.exit(1);
    }
};

// Ejecutar
seedAnalytics();
