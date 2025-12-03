  const mongoose = require("mongoose");

  require("dotenv").config();

  const MONGO_URI = process.env.MONGO_URI;

  // IMPORTA MODELOS
  const User = require("../models/User");
  const Store = require("../models/Store");
  const Product = require("../models/Product");
  const Order = require("../models/Order");

  (async () => {
    try {
      console.log("🔌 Conectando a Mongo Atlas...");
      await mongoose.connect(MONGO_URI);

      console.log("📦 Obteniendo datos reales existentes...");

      const users = await User.find({});
      const stores = await Store.find({});
      const products = await Product.find({});

      console.log(`Usuarios: ${users.length}`);
      console.log(`Tiendas: ${stores.length}`);
      console.log(`Productos: ${products.length}`);

      if (!users.length || !stores.length || !products.length) {
        console.log("❌ No hay datos suficientes en tu BD. Abortando.");
        return;
      }

      // ------------------------------------
      // OPCIONAL: BORRAR PEDIDOS ANTERIORES
      // ------------------------------------
      console.log("🗑️ Borrando pedidos anteriores...");
      await Order.deleteMany({});

      console.log("📝 Creando nuevos pedidos...");

      // Crear 1 pedido por usuario
      for (const user of users) {
        // Elegir un producto aleatorio
        const product = products[Math.floor(Math.random() * products.length)];

        // Encontrar su tienda real
        const store = stores.find(
          (s) => s._id.toString() === product.storeId.toString()
        );

        if (!store) continue;

        await Order.create({
          customerId: user._id,
          storeId: store._id,
          items: [
            {
              productId: product._id,
              quantity: 1,
              price: product.price,
            },
          ],
          status: "pending",
          total: product.price,
          createdAt: new Date(),
        });

        console.log(`✔ Pedido creado para ${user.email} → ${product.title}`);
      }

      console.log("\n🎉 SEED FINALIZADO: pedidos creados con datos reales");

      mongoose.disconnect();
    } catch (err) {
      console.error("❌ Error ejecutando seed:", err);
      mongoose.disconnect();
    }
  })();
