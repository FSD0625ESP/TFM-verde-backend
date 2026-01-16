const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");
const Store = require("../models/store");
const Address = require("../models/address");
const Notification = require("../models/notification");
const mongoose = require("mongoose");
const { getIO, getUserSocketId } = require("../services/socket");

// Obtener todas las órdenes del usuario
const getOrders = async (req, res) => {
  try {
    console.log("🔍 getOrders - User ID (string):", req.user._id);
    console.log("🔍 getOrders - User ID type:", typeof req.user._id);

    // Usar el _id directamente - Mongoose lo convertirá automáticamente
    const orders = await Order.find({ customerId: req.user.id })
      .populate("items.productId")
      .populate("addressId")

      // Filtro para ordenar los pedidos por fecha y por precio
      .sort({ createdAt: -1, "items.price": -1 });
    console.log("📦 Órdenes encontradas:", orders.length);
    console.log("🔍 Órdenes:", orders);
    res.json(orders);
  } catch (err) {
    console.error("❌ Error en getOrders:", err);
    res.status(500).json({ error: "Error obteniendo las órdenes" });
  }
};

// Obtener una orden por ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customerId: req.user._id,
    })
      .populate("items.productId")
      .populate("addressId");
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo la orden" });
  }
};

// Crear una nueva orden
// después de guardar en la base de datos, envía un correo de confirmación al usuario y al vendedor
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { storeId, addressId, items } = req.body;

    // el usuario tiene que estar autenticado
    // así se evita que se pueda crear una orden para otro usuario
    const customerId = req.user.id;

    console.log("📝 createOrder recibido:", {
      customerId,
      storeId,
      addressId,
      itemsCount: items?.length,
    });

    // Validaciones
    if (!customerId) {
      return res.status(400).json({ message: "customerId es requerido" });
    }
    const user = await User.findById(customerId).session(session);
    if (!user) {
      return res.status(400).json({ message: "El usuario no existe" });
    }
    if (!storeId) {
      return res.status(400).json({ message: "storeId es requerido" });
    }
    const store = await Store.findById(storeId).session(session);
    if (!store) {
      return res.status(400).json({ message: "La tienda no existe" });
    }
    const storeName = store.name;
    if (!addressId) {
      return res.status(400).json({ message: "addressId es requerido" });
    }
    const address = await Address.findById(addressId).session(session);
    if (!address) {
      return res.status(400).json({ message: "La dirección no existe" });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "items no puede estar vacío" });
    }

    // Obtener productos
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(
      session
    );

    if (products.length !== items.length) {
      throw new Error("Uno o más productos no existen");
    }

    let totalItems = 0;
    let totalPrice = 0;

    // Validar stock y preparar items
    const orderItems = items.map((item) => {
      const product = products.find((p) => p._id.equals(item.productId));

      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.title}`);
      }

      totalItems += item.quantity;
      totalPrice += product.price * item.quantity;

      return {
        productId: product._id,
        quantity: item.quantity,
        price: product.price,
      };
    });

    // Reducir stock de los productos en la bbdd
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    // Crear pedido
    const [order] = await Order.create(
      [
        {
          customerId,
          storeId,
          addressId,
          items: orderItems,
        },
      ],
      { session }
    );

    console.log("✅ Orden creada:", order._id);

    await session.commitTransaction();
    session.endSession();

    // Enviar email de confirmación al usuario (fuera de transacción)
    const { sendOrderConfirmationEmail } = require("../services/emails");

    try {
      // Obtener los detalles de cada producto
      const itemsInfo = orderItems.map((item) => {
        const product = products.find((p) => p._id.equals(item.productId));
        return {
          productName: product.title,
          productImage: product.images[0]?.url || null,
          quantity: item.quantity,
          price: item.price,
        };
      });

      // Enviar email de confirmación de pedido
      await sendOrderConfirmationEmail({
        to: user.email,
        firstName: user.firstName,
        storeName,
        itemsInfo,
        totalItems,
        totalPrice,
        address,
      });
    } catch (e) {
      console.error("⚠️ Email no enviado al usuario:", e.message);
    }

    // Enviar email de confirmación a la tienda (fuera de transacción)
    const { sendOrderNotificationToStoreEmail } = require("../services/emails");

    const seller = await User.findById(store.ownerId);

    try {
      // Obtener los detalles de cada producto
      const itemsInfo = orderItems.map((item) => {
        const product = products.find((p) => p._id.equals(item.productId));
        return {
          productName: product.title,
          productImage: product.images[0]?.url || null,
          quantity: item.quantity,
          price: item.price,
        };
      });

      // Enviar email de confirmación de pedido al vendedor
      await sendOrderNotificationToStoreEmail({
        to: seller.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storeName,
        itemsInfo,
        totalItems,
        totalPrice,
        address,
      });
    } catch (e) {
      console.error("⚠️ Email no enviado a la tienda:", e.message);
    }

    // ===============================
    // Notificación en tiempo real al vendedor cuando se crea la orden
    // ===============================
    try {
      const sellerId = store.ownerId;

      // Guardar notificación en BD
      const notification = await Notification.create({
        userId: sellerId,
        storeId,
        type: "new_order",
        entityId: order._id,
      });

      // Obtener instancia de Socket.IO
      const io = getIO();

      // Emitir socket si el vendedor está conectado
      const socketId = getUserSocketId(String(sellerId));

      if (socketId) {
        io.to(socketId).emit("new_order_notification", {
          orderId: order._id,
          storeId,
          storeName,
          totalItems,
          totalPrice,
          createdAt: order.createdAt,
        });

        notification.delivered = true;
        await notification.save();
      }
    } catch (e) {
      console.error("⚠️ Error notificando al vendedor:", e.message);
    }

    res.status(201).json(order);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Error creando la orden:", err);
    res.status(400).json({
      error: "Error creando la orden",
      message: err.message,
      details: err.errors,
    });
  }
};

// Actualizar una orden (ej. status)
const updateOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user._id },
      req.body,
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando la orden" });
  }
};

// Eliminar una orden (soft delete)
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user._id },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ message: "Orden eliminada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando la orden" });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};
