const mongoose = require("mongoose");
const Order = require("../models/order");
const Store = require("../models/store");
const Product = require("../models/product");
const User = require("../models/user");
const Address = require("../models/address");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
console.log("MONGODB_URI:", MONGO_URI);

// Configuración del seeder
const CONFIG = {
    // Días hacia atrás para generar órdenes
    daysBack: 90,
    // Órdenes por día (rango)
    ordersPerDay: { min: 2, max: 15 },
    // Productos por orden (rango)
    productsPerOrder: { min: 1, max: 5 },
    // Cantidad por producto (rango)
    quantityPerProduct: { min: 1, max: 3 },
    // Distribución de estados de orden
    statusDistribution: {
        pending: 10,
        shipped: 20,
        delivered: 65,
        canceled: 5,
    },
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

// Obtener estado aleatorio según distribución
const getOrderStatus = () => {
    const items = Object.entries(CONFIG.statusDistribution).map(([status, weight]) => ({
        status,
        weight,
    }));
    return weightedRandom(items).status;
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

// Crear dirección temporal si el usuario no tiene
const createTemporaryAddress = async (userId) => {
    const existingAddress = await Address.findOne({ userId, deletedAt: null });
    if (existingAddress) return existingAddress._id;

    const address = new Address({
        userId,
        title: "Dirección de prueba",
        street: `Calle ${Math.floor(Math.random() * 100) + 1}`,
        city: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao"][Math.floor(Math.random() * 5)],
        state: ["Madrid", "Cataluña", "Valencia", "Andalucía", "País Vasco"][Math.floor(Math.random() * 5)],
        postalCode: String(Math.floor(Math.random() * 50000) + 10000),
        country: "España",
        phoneNumber: `+34 ${Math.floor(Math.random() * 900000000) + 600000000}`,
        isDefault: true,
    });
    await address.save();
    return address._id;
};

// Generar órdenes para una tienda
const generateOrdersForStore = async (store, products, customers) => {
    const orders = [];
    const now = new Date();

    if (products.length === 0) {
        console.log(`   ⚠️  Tienda ${store.name} no tiene productos, saltando...`);
        return orders;
    }

    for (let daysAgo = 0; daysAgo < CONFIG.daysBack; daysAgo++) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(0, 0, 0, 0);

        // Más órdenes en días recientes
        const recencyFactor = 1 - (daysAgo / CONFIG.daysBack) * 0.6;
        // Más órdenes en fines de semana
        const dayOfWeek = date.getDay();
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.4 : 1;
        // Pico en Black Friday y Navidad (noviembre-diciembre)
        const month = date.getMonth();
        const seasonalFactor = (month === 10 || month === 11) ? 1.5 : 1;

        const baseOrders = CONFIG.ordersPerDay.min +
            Math.random() * (CONFIG.ordersPerDay.max - CONFIG.ordersPerDay.min);
        const numOrders = Math.floor(baseOrders * recencyFactor * weekendFactor * seasonalFactor);

        for (let i = 0; i < numOrders; i++) {
            // Seleccionar cliente aleatorio
            const customer = customers[Math.floor(Math.random() * customers.length)];
            if (!customer) continue;

            // Obtener o crear dirección
            const addressId = await createTemporaryAddress(customer._id);

            // Seleccionar productos aleatorios de esta tienda
            const numProducts = Math.floor(
                CONFIG.productsPerOrder.min +
                Math.random() * (CONFIG.productsPerOrder.max - CONFIG.productsPerOrder.min + 1)
            );

            const selectedProducts = [];
            const usedProductIds = new Set();

            for (let j = 0; j < numProducts && j < products.length; j++) {
                let product;
                let attempts = 0;
                do {
                    product = products[Math.floor(Math.random() * products.length)];
                    attempts++;
                } while (usedProductIds.has(product._id.toString()) && attempts < 10);

                if (!usedProductIds.has(product._id.toString())) {
                    usedProductIds.add(product._id.toString());

                    const quantity = Math.floor(
                        CONFIG.quantityPerProduct.min +
                        Math.random() * (CONFIG.quantityPerProduct.max - CONFIG.quantityPerProduct.min + 1)
                    );

                    selectedProducts.push({
                        productId: product._id,
                        quantity,
                        price: product.price || Math.floor(Math.random() * 100) + 10,
                    });
                }
            }

            if (selectedProducts.length === 0) continue;

            const orderDate = getRandomTimeInDay(date);
            const status = getOrderStatus();

            orders.push({
                customerId: customer._id,
                storeId: store._id,
                addressId,
                items: selectedProducts,
                status,
                createdAt: orderDate,
                updatedAt: orderDate,
            });
        }
    }

    return orders;
};

// Función principal del seeder
const seedOrders = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Conectado a MongoDB");

        // Obtener todas las tiendas
        const stores = await Store.find({});
        console.log(`📦 Encontradas ${stores.length} tiendas`);

        if (stores.length === 0) {
            console.log("❌ No hay tiendas. Ejecuta primero el seeder de tiendas.");
            process.exit(1);
        }

        // Obtener todos los usuarios (clientes)
        const customers = await User.find({ role: "customer" });
        console.log(`👥 Encontrados ${customers.length} clientes`);

        if (customers.length === 0) {
            console.log("⚠️  No hay clientes. Creando usuarios de prueba...");
            // Crear algunos usuarios de prueba
            const testCustomers = [];
            for (let i = 1; i <= 20; i++) {
                const user = new User({
                    email: `customer${i}@test.com`,
                    firstName: `Cliente`,
                    lastName: `Test${i}`,
                    password: "$2a$10$dummyhashpassword", // Hash dummy
                    role: "customer",
                    provider: "local",
                });
                await user.save();
                testCustomers.push(user);
            }
            customers.push(...testCustomers);
            console.log(`   ✅ Creados ${testCustomers.length} usuarios de prueba`);
        }

        // Limpiar órdenes existentes
        const deleteResult = await Order.deleteMany({});
        console.log(`🗑️  Eliminadas ${deleteResult.deletedCount} órdenes anteriores`);

        let totalOrders = 0;
        let totalRevenue = 0;

        for (const store of stores) {
            console.log(`\n🏪 Procesando tienda: ${store.name}`);

            // Obtener productos de la tienda
            const products = await Product.find({ storeId: store._id });
            console.log(`   📦 ${products.length} productos encontrados`);

            // Generar órdenes
            const orders = await generateOrdersForStore(store, products, customers);
            console.log(`   🛒 ${orders.length} órdenes generadas`);

            if (orders.length === 0) continue;

            // Calcular revenue de esta tienda
            const storeRevenue = orders.reduce((sum, order) => {
                if (order.status !== "canceled") {
                    return sum + order.items.reduce((itemSum, item) =>
                        itemSum + (item.price * item.quantity), 0);
                }
                return sum;
            }, 0);

            // Insertar en lotes de 500
            const batchSize = 500;
            for (let i = 0; i < orders.length; i += batchSize) {
                const batch = orders.slice(i, i + batchSize);
                await Order.insertMany(batch);
                process.stdout.write(`   💾 Insertadas ${Math.min(i + batchSize, orders.length)}/${orders.length}\r`);
            }
            console.log(`   💰 Revenue generado: ${storeRevenue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`);
            console.log(`   ✅ Completado`);

            totalOrders += orders.length;
            totalRevenue += storeRevenue;
        }

        console.log(`\n🎉 Seeding de órdenes completado!`);
        console.log(`   🛒 Total de órdenes creadas: ${totalOrders.toLocaleString()}`);
        console.log(`   💰 Revenue total generado: ${totalRevenue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`);

        // Mostrar resumen por estado
        const summary = await Order.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalItems: { $sum: { $size: "$items" } },
                },
            },
            { $sort: { count: -1 } },
        ]);

        console.log("\n📈 Resumen por estado:");
        summary.forEach((item) => {
            console.log(`   ${item._id}: ${item.count.toLocaleString()} órdenes (${item.totalItems.toLocaleString()} items)`);
        });

        // Mostrar top tiendas por órdenes
        const topStores = await Order.aggregate([
            {
                $group: {
                    _id: "$storeId",
                    orders: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $ne: ["$status", "canceled"] },
                                { $sum: { $map: { input: "$items", as: "item", in: { $multiply: ["$$item.price", "$$item.quantity"] } } } },
                                0
                            ]
                        }
                    }
                },
            },
            { $sort: { orders: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "stores",
                    localField: "_id",
                    foreignField: "_id",
                    as: "store"
                }
            },
            { $unwind: "$store" }
        ]);

        console.log("\n🏆 Top 5 tiendas por órdenes:");
        topStores.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.store.name}: ${item.orders} órdenes - ${item.revenue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Error en el seeding:", error);
        process.exit(1);
    }
};

// Ejecutar
seedOrders();
