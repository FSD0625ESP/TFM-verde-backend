const mongoose = require("mongoose");
const Chat = require("../models/chat");
const User = require("../models/user");
const Store = require("../models/store");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;

const createChatSeeds = async () => {
    try {
        console.log("Conectando a MongoDB...");
        await mongoose.connect(MONGO_URI || "mongodb://localhost:27017/tfm-database");
        console.log("Conectado a MongoDB");

        // Limpiar chats existentes
        await Chat.deleteMany({});
        console.log("Chats anteriores eliminados");

        // Obtener usuarios y tiendas
        const customers = await User.find({ role: "customer" }).limit(5);
        const sellers = await User.find({ role: "seller" }).limit(10);
        const stores = await Store.find().populate('ownerId');

        if (customers.length === 0) {
            console.log("No hay usuarios customer. Creando algunos...");
            // Crear algunos clientes de prueba
            const bcrypt = require("bcrypt");
            for (let i = 1; i <= 5; i++) {
                await User.create({
                    email: `customer${i}@example.com`,
                    firstName: `Cliente${i}`,
                    lastName: `Apellido${i}`,
                    password: await bcrypt.hash("Customer123@", 10),
                    role: "customer",
                });
            }
            customers.push(...await User.find({ role: "customer" }).limit(5));
        }

        if (stores.length === 0) {
            console.log("No hay tiendas disponibles. Por favor ejecuta primero el seed de tiendas.");
            process.exit(1);
        }

        console.log(`Creando chats con ${customers.length} clientes y ${stores.length} tiendas...`);

        const conversationTemplates = [
            [
                { role: "customer", text: "Hola, me interesa el producto que tienes publicado" },
                { role: "seller", text: "¡Hola! Muchas gracias por tu interés. ¿Cuál producto en particular te interesa?" },
                { role: "customer", text: "El collar de plata que vi en tu catálogo" },
                { role: "seller", text: "¡Perfecto! Ese collar es una pieza única hecha a mano. ¿Necesitas alguna información adicional?" },
                { role: "customer", text: "¿Está disponible para envío inmediato?" },
                { role: "seller", text: "Sí, lo tengo en stock. Puedo enviarlo mañana mismo" },
            ],
            [
                { role: "customer", text: "Buenos días, ¿hacen envíos a toda España?" },
                { role: "seller", text: "¡Buenos días! Sí, hacemos envíos a toda España. El tiempo de entrega es de 3-5 días laborables" },
                { role: "customer", text: "Perfecto, ¿cuál es el coste del envío?" },
                { role: "seller", text: "El envío tiene un coste de 4.95€ para pedidos inferiores a 50€. Por encima de esa cantidad el envío es gratuito" },
            ],
            [
                { role: "customer", text: "Hola! Quería consultar sobre las tallas disponibles" },
                { role: "seller", text: "¡Hola! Por supuesto, ¿qué producto te interesa?" },
                { role: "customer", text: "La camiseta artesanal que vi ayer" },
                { role: "seller", text: "Tenemos disponibles las tallas S, M, L y XL. Son tallas unisex" },
                { role: "customer", text: "Genial, me quedo con la M" },
            ],
            [
                { role: "customer", text: "¿Podría reservar este artículo?" },
                { role: "seller", text: "Claro que sí, ¿por cuánto tiempo necesitas la reserva?" },
                { role: "customer", text: "Hasta el viernes si es posible" },
                { role: "seller", text: "Sin problema, te lo reservo hasta el viernes. ¿Necesitas algo más?" },
            ],
            [
                { role: "customer", text: "Me encanta tu tienda! ¿Tienes más productos como este?" },
                { role: "seller", text: "¡Muchas gracias! Sí, voy subiendo productos nuevos cada semana. Te recomiendo que sigas la tienda para estar al día" },
                { role: "customer", text: "Ya lo hice! ¿Aceptas pedidos personalizados?" },
                { role: "seller", text: "Sí, acepto pedidos personalizados. Cuéntame qué tienes en mente y vemos si puedo hacerlo" },
            ],
        ];

        const chatsCreated = [];

        // Crear chats entre clientes y tiendas
        for (let i = 0; i < Math.min(customers.length, 5); i++) {
            const customer = customers[i];
            // Cada cliente tiene conversación con 1-3 tiendas diferentes
            const numChats = Math.floor(Math.random() * 3) + 1;

            for (let j = 0; j < numChats && j < stores.length; j++) {
                const store = stores[(i + j) % stores.length];
                const template = conversationTemplates[Math.floor(Math.random() * conversationTemplates.length)];

                const messages = template.map((msg, idx) => {
                    const isCustomerMessage = msg.role === "customer";
                    // Crear timestamps escalonados (cada mensaje 5-30 minutos después del anterior)
                    const minutesAgo = (template.length - idx) * (Math.floor(Math.random() * 25) + 5);
                    const timestamp = new Date(Date.now() - minutesAgo * 60 * 1000);

                    return {
                        senderId: isCustomerMessage ? customer._id : store.ownerId._id,
                        text: msg.text,
                        timestamp: timestamp
                    };
                });

                const chat = await Chat.create({
                    storeId: store._id,
                    userId: customer._id,
                    messages: messages,
                });

                chatsCreated.push(chat);
                console.log(`Chat creado entre ${customer.firstName} y tienda ${store.name}`);
            }
        }

        console.log(`\n✅ ${chatsCreated.length} chats creados exitosamente!`);
        console.log("\nPara probar el chat:");
        console.log("1. Inicia sesión como cliente (customer1@example.com / Customer123@)");
        console.log("2. Inicia sesión como vendedor (seller1@example.com / Seller123@)");
        console.log("3. Verás las conversaciones en el chat flotante");

        process.exit(0);
    } catch (error) {
        console.error("Error creando seeds de chat:", error);
        process.exit(1);
    }
};

createChatSeeds();
