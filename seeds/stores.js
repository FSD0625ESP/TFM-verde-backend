const mongoose = require("mongoose");
const Store = require("../models/store");
const Product = require("../models/product");
const User = require("../models/user");
const Category = require("../models/category");
const bcrypt = require("bcrypt");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
console.log("MONGODB_URI:", MONGO_URI);

const createSeeds = async () => {
    try {
        // Limpiar las colecciones existentes
        await Store.deleteMany({});
        await Product.deleteMany({});
        await User.deleteMany({});
        await Category.deleteMany({});
        // Crear un usuario administrador y algunos vendedores
        const adminUser = await User.create({
            email: "admin@example.com",
            firstName: "Admin",
            lastName: "User",
            password: await bcrypt.hash("admin123@", 10),
            role: "admin",
        });

        const sellers = [];
        for (let i = 1; i <= 10; i++) {
            const seller = await User.create({
                email: `seller${i}@example.com`,
                firstName: `Seller${i}`,
                lastName: `Surname${i}`,
                password: await bcrypt.hash("Seller123@", 10),
                role: "seller",
            });
            sellers.push(seller);
        }

        // Crear algunas categorías
        const categories = await Category.create([
            { name: "Ropa", description: "Todo tipo de prendas de vestir" },
            { name: "Accesorios", description: "Complementos de moda" },
            { name: "Arte", description: "Obras de arte y artesanía" },
            {
                name: "Decoración",
                description: "Artículos decorativos para el hogar",
            },
            { name: "Joyería", description: "Joyas y bisutería" },
        ]);

        // Crear tiendas
        const storeNames = [
            "Boutique Elegance",
            "Artesanía Creativa",
            "Vintage Treasures",
            "Modern Design",
            "Eco Fashion",
            "Arte y Vida",
            "Casa Bonita",
            "Joyas del Mar",
            "Fashion Hub",
            "Diseño Natural",
        ];

        for (let i = 0; i < 10; i++) {
            const store = await Store.create({
                ownerId: sellers[i]._id,
                name: storeNames[i],
                description: `Una tienda única especializada en productos artesanales y de diseño - ${storeNames[i]}`,
                logo: `https://picsum.photos/200/200?random=${i}`,
                billingInfo: {
                    name: `${sellers[i].firstName} ${sellers[i].lastName}`,
                    address: `Calle Principal ${i + 1}, 08001 Barcelona`,
                    phone: `+34 6${String(i).padStart(2, "0")}0 000 000`,
                    email: `contact@${storeNames[i]
                        .toLowerCase()
                        .replace(/\s+/g, "")}.com`,
                },
                socialLinks: {
                    instagram: `@${storeNames[i].toLowerCase().replace(/\s+/g, "")}`,
                    facebook: `/${storeNames[i].toLowerCase().replace(/\s+/g, "")}`,
                    web: `https://${storeNames[i].toLowerCase().replace(/\s+/g, "")}.com`,
                },
            });

            // Crear productos para cada tienda
            const productTypes = [
                "Camiseta",
                "Bolso",
                "Cuadro",
                "Lámpara",
                "Collar",
                "Pulsera",
                "Vestido",
                "Decoración",
                "Escultura",
                "Anillo",
            ];

            for (let j = 0; j < 10; j++) {
                await Product.create({
                    storeId: store._id,
                    title: `${productTypes[j]} ${i + 1}`,
                    description: `Hermoso ${productTypes[j].toLowerCase()} artesanal de ${storeNames[i]
                        }`,
                    price: Math.floor(Math.random() * 150) + 20,
                    images: [
                        `https://picsum.photos/400/400?random=${i}${j}1`,
                        `https://picsum.photos/400/400?random=${i}${j}2`,
                    ],
                    status: Math.random() > 0.2 ? "onSale" : "exhibition",
                    stock: Math.floor(Math.random() * 50) + 1,
                    categories: [
                        categories[Math.floor(Math.random() * categories.length)]._id,
                    ],
                });
            }
        }

        console.log("Seeds creados exitosamente!");
        process.exit(0);
    } catch (error) {
        console.error("Error creando seeds:", error);
        process.exit(1);
    }
};

// Conectar a MongoDB y ejecutar los seeds
mongoose
    .connect(MONGO_URI || "mongodb://localhost:27017/tfm-database")
    .then(async () => {
        console.log("Conectado a MongoDB");
        try {
            // Vaciar la base de datos antes de crear los seeds
            await mongoose.connection.dropDatabase();
            console.log("Base de datos vaciada");
        } catch (err) {
            console.error("Error vaciando la base de datos:", err);
            process.exit(1);
        }

        createSeeds();
    })
    .catch((err) => {
        console.error("Error conectando a MongoDB:", err);
        process.exit(1);
    });
