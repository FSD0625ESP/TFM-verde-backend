const mongoose = require("mongoose");
const Store = require("../models/store");
const Product = require("../models/product");
const User = require("../models/user");
const Category = require("../models/category");
const bcrypt = require("bcrypt");
// Removed fs and path requires since we will use inline SVG data URIs instead of writing files to disk.
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
      const logoColors = [
        "#2ECC71",
        "#3498DB",
        "#9B59B6",
        "#E67E22",
        "#E74C3C",
        "#1ABC9C",
        "#F1C40F",
        "#34495E",
        "#7F8C8D",
        "#27AE60",
      ];
      const color = logoColors[i % logoColors.length];

      // Iniciales de la tienda para colocar en el logo
      const storeInitials = storeNames[i]
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'>
  <rect width='100' height='100' rx='16' fill='${color}' />
  <g transform='translate(50,58)'>
    <text x='0' y='0' text-anchor='middle' font-family='Helvetica, Arial, sans-serif' font-size='36' font-weight='700' fill='white'>${storeInitials}</text>
  </g>
</svg>`;

      const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

      // Seleccionar entre 1 y 3 categorías distintas aleatoriamente
      const numCategories = Math.floor(Math.random() * 3) + 1; // 1..3
      const chosenCategoryIds = [];
      const usedCatIdx = new Set();
      while (chosenCategoryIds.length < numCategories) {
        const idx = Math.floor(Math.random() * categories.length);
        if (!usedCatIdx.has(idx)) {
          usedCatIdx.add(idx);
          chosenCategoryIds.push(categories[idx]._id);
        }
      }

      const store = await Store.create({
        ownerId: sellers[i]._id,
        name: storeNames[i],
        description: `Una tienda única especializada en productos artesanales y de diseño - ${storeNames[i]}`,
        logo: logoDataUri,
        image: `https://picsum.photos/600/400?random=${i}`,
        categories: chosenCategoryIds,
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
        // Asignar a cada producto una categoría aleatoria perteneciente a la tienda
        const productCategory =
          chosenCategoryIds[
            Math.floor(Math.random() * chosenCategoryIds.length)
          ];

        await Product.create({
          storeId: store._id,
          title: `${productTypes[j]} ${i + 1}`,
          description: `Hermoso ${productTypes[j].toLowerCase()} artesanal de ${
            storeNames[i]
          }`,
          price: Math.floor(Math.random() * 150) + 20,
          images: [
            `https://picsum.photos/400/400?random=${i}${j}1`,
            `https://picsum.photos/400/400?random=${i}${j}2`,
          ],
          status: Math.random() > 0.2 ? "onSale" : "exhibition",
          nuevo: Math.random() > 0.6,
          oferta: Math.random() > 0.7,
          destacado: Math.random() > 0.8,
          stock: Math.floor(Math.random() * 50) + 1,
          categories: [productCategory],
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
