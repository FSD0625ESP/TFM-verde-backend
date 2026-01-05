const mongoose = require("mongoose");
const Store = require("../models/store");
const Product = require("../models/product");
const User = require("../models/user");
const Category = require("../models/category");
const Review = require("../models/review");
const bcrypt = require("bcrypt");
//const generateSlug = require("../utils/generateSlug");
// Removed fs and path requires since we will use inline SVG data URIs instead of writing files to disk.
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
console.log("MONGODB_URI:", MONGO_URI);

const slugify = require("slugify");

const generateSlug = (text) => {
  if (!text) return "";

  return slugify(text, {
    lower: true, // convierte a minúsculas
    strict: true, // elimina caracteres especiales
    locale: "es", // soporte para tildes y ñ
    trim: true,
  });
};

const createSeeds = async () => {
  try {
    // Limpiar las colecciones existentes
    await Store.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    await Category.deleteMany({});
    await Review.deleteMany({});

    // Crear un usuario administrador y algunos vendedores
    const adminUser = await User.create({
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      password: await bcrypt.hash("admin123@", 10),
      role: "admin",
    });

    const customers = [];
    for (let i = 1; i <= 10; i++) {
      const customer = await User.create({
        email: `customer${i}@example.com`,
        firstName: `Customer${i}`,
        lastName: `Surname${i}`,
        password: await bcrypt.hash("Customer123@", 10),
        role: "customer",
      });
      customers.push(customer);
    }

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
      {
        name: "Juguetes",
        description: "Juguetes y juegos para todas las edades",
      },
      { name: "Muebles", description: "Muebles y decoración para el hogar" },
      { name: "Jardineria", description: "Jardineria" },
      { name: "Cocina", description: "Cocina" },
      {
        name: "Cuidado Personal",
        description: "Productos de belleza y cuidado personal",
      },
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
        active: true,
        name: storeNames[i],
        slug: generateSlug(storeNames[i]),
        description: `Una tienda única especializada en productos artesanales y de diseño - ${storeNames[i]}`,
        longDescription: `Bienvenido a ${storeNames[i]}, tu destino para encontrar productos únicos y hechos a mano. Nuestra tienda se especializa en ofrecer una variedad de artículos que combinan calidad, creatividad y estilo. Desde ropa y accesorios hasta arte y decoración para el hogar, cada producto en nuestra tienda ha sido cuidadosamente seleccionado para satisfacer los gustos más exigentes. Explora nuestra colección y descubre piezas que reflejan tu personalidad y estilo de vida.`,
        logo: logoDataUri,
        image: `https://picsum.photos/1600/900?random=${i}`,
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
          instagram: `https://www.instagram.com/${storeNames[i]
            .toLowerCase()
            .replace(/\s+/g, "")}`,
          facebook: `https://www.facebook.com/${storeNames[i]
            .toLowerCase()
            .replace(/\s+/g, "")}`,
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
          slug: generateSlug(`${productTypes[j]} ${i + 1}`),
          description: `Hermoso ${productTypes[j].toLowerCase()} artesanal de ${
            storeNames[i]
          }`,
          longDescription: `Este ${productTypes[
            j
          ].toLowerCase()} es una pieza única hecha a mano en nuestra tienda ${
            storeNames[i]
          }. Perfecto para quienes aprecian la calidad y el diseño exclusivo. 
          Ideal para cualquier ocasión, este ${productTypes[
            j
          ].toLowerCase()} combina estilo y artesanía en cada detalle.`,
          price: Math.floor(Math.random() * 150) + 20,
          images: [
            {
              url: `https://picsum.photos/1200/1200?random=${i}${j}0`,
              public_id: `product_${i}_${j}_0`,
            },
          ],
          status: Math.random() > 0.2 ? "onSale" : "exhibition",
          nuevo: Math.random() > 0.6,
          oferta: Math.random() > 0.7,
          destacado: Math.random() > 0.8,
          stock: Math.floor(Math.random() * 50) + 1,
          categories: [productCategory],
        });
      }

      //const customers = await User.find({ role: "customer" });

      // crear reviews aleatorios para cada tienda
      const numReviews = Math.floor(Math.random() * 5) + 1; // 1..5
      for (let j = 0; j < numReviews; j++) {
        const rating = Math.floor(Math.random() * 5) + 1; // 1..5
        const review = await Review.create({
          storeId: store._id,
          userId: customers[i]._id,
          rating: rating,
          comment: `Comentario ${j + 1} para la tienda ${
            store.name
          }. Rating: ${rating}`,
        });
      }

      // crear reviews aleatorias para cada producto de la tienda
      const products = await Product.find({ storeId: store._id });
      for (const product of products) {
        const numReviews = Math.floor(Math.random() * 6) + 1; // 1..6
        for (let j = 0; j < numReviews; j++) {
          const rating = Math.floor(Math.random() * 5) + 1; // 1..5
          const review = await Review.create({
            productId: product._id,
            userId: customers[i]._id,
            rating: rating,
            comment: `Comentario ${j + 1} para el producto ${
              product.title
            } de la tienda ${store.name}. Rating: ${rating}`,
          });
        }
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
