const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");
const Store = require("../models/store");
const Address = require("../models/address");
const Notification = require("../models/notification");
const mongoose = require("mongoose");
const { getIO, getUserSocketId } = require("../services/socket");
const Delivery = require("../models/delivery");
const {
  geocodeAddress,
  getRoute,
  interpolateRoute,
  hasToken,
} = require("../services/mapbox");

const WAREHOUSE_ADDRESS =
  "Carrer de Mèxic, 17, 4, Sants-Montjuïc, 08004 Barcelona";

// Obtener todas las órdenes del usuario
const getOrders = async (req, res) => {
  try {
    // Verificar autenticación
    if (!req.user || !req.user.id) {
      console.log("🔒 getOrders - petición no autenticada");
      return res.status(401).json({ error: "No autenticado" });
    }

    console.log("🔍 getOrders - User ID (string):", req.user.id);
    console.log("🔍 getOrders - User ID type:", typeof req.user.id);

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

const getAdminOrders = async (req, res) => {
  try {
    console.log("🔍 getAdminOrders - User ID (string):", req.user.id);
    const storeId = await Store.findOne({ ownerId: req.user.id })
      .select("_id")
      .lean();
    if (!storeId) {
      console.log("❗ Tienda no encontrada para el usuario:", req.user.id);
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    // Parámetros de paginación y ordenación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    // Construir objeto de ordenación
    const sortObj = {};
    sortObj[sortField] = sortOrder;

    // Construir filtro base
    const filter = { storeId: storeId._id };

    console.log("🔍 getAdminOrders - Parámetros:", {
      page,
      limit,
      sortField,
      sortOrder,
      search,
      storeId: storeId._id,
    });

    // Si hay búsqueda, primero buscar usuarios que coincidan
    if (search) {
      const User = require("../models/user");
      const searchRegex = new RegExp(search, "i");

      // Buscar usuarios que coincidan con nombre, apellido o email
      const matchingUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ],
      })
        .select("_id")
        .lean();

      const userIds = matchingUsers.map((u) => u._id);

      // Construir array de condiciones de búsqueda
      const orConditions = [
        { status: searchRegex },
        { customerId: { $in: userIds } },
      ];

      // Solo buscar por _id si el valor es un ObjectId válido
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: search });
      }

      filter.$or = orConditions;
    }

    // Usar el _id directamente - Mongoose lo convertirá automáticamente
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("items.productId")
        // populate user details
        .populate("customerId", "firstName lastName email profileImage")
        .populate("addressId")
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    console.log("📦 Órdenes encontradas:", orders.length, "de", total);

    res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("❌ Error en getAdminOrders:", err);
    res
      .status(500)
      .json({ error: "Error obteniendo las órdenes", details: err.message });
  }
};

// Obtener una orden por ID
const getOrderById = async (req, res) => {
  try {
    console.log("🔍 getOrderById - User ID (string):", req.user.id);
    const order = await Order.findById(req.params.id)
      .populate("items.productId")
      .populate("customerId", "firstName lastName email profileImage")
      .populate("addressId");

    if (!order) {
      console.log("❗ Orden no encontrada en DB para id:", req.params.id);
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    // Comprobar que el usuario autenticado es el propietario
    if (order.customerId._id.toString() !== req.user.id.toString()) {
      console.log(
        "⛔ Acceso denegado: usuario",
        req.user.id,
        "no es propietario de la orden",
        req.params.id
      );
      return res
        .status(403)
        .json({ error: "No tienes permiso para ver esta orden" });
    }

    // Devuelve la orden
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
          statusDates: {
            pending: new Date(),
          },
        },
      ],
      { session }
    );

    // Crear delivery simulado (dev) para tracking en tiempo real
    // - Origen: dirección hardcoded (almacén)
    // - Destino: addressId del pedido
    try {
      const address = await Address.findById(addressId).lean();
      if (address) {
        const destinationText = `${address.street}, ${address.postalCode} ${address.city
          }, ${address.state}, ${address.country || "España"}`;

        let origin;
        let destination;

        if (hasToken()) {
          origin = await geocodeAddress(WAREHOUSE_ADDRESS);
          destination = await geocodeAddress(destinationText);
        } else {
          // Fallback razonable sin Mapbox (centro BCN aproximado + jitter)
          origin = { lat: 41.3735, lng: 2.1492 };
          destination = { lat: 41.3851, lng: 2.1734 };
        }

        let route;
        try {
          route = hasToken()
            ? await getRoute({ origin, destination })
            : interpolateRoute({ origin, destination, steps: 40 });
        } catch (_) {
          route = interpolateRoute({ origin, destination, steps: 40 });
        }

        const delivery = await Delivery.create({
          orderId: order._id,
          status: "pending",
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          route,
          currentIndex: 0,
          startedAt: null,
          eta: null,
        });

        // Añadimos deliveryId como extra (no rompe si el frontend ignora la prop)
        order.deliveryId = delivery._id;
      }
    } catch (_) {
      // Si algo falla, el pedido sigue creándose (no rompemos checkout)
    }

    // console.log("✅ Orden creada:", order._id);

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

    // emitir notificación por socket al vendedor (si está conectado)
    const io = req.app.get("io");

    const sellerSocketId = getUserSocketId(store.ownerId.toString());

    if (sellerSocketId) {
      io.to(sellerSocketId).emit("new_order", {
        orderId: order._id,
        storeId,
        totalItems,
        totalPrice,
      });
    }

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

const isUserAdmin = async ({ userId, order }) => {
  const store = await Store.findById(order.storeId).select("ownerId");
  if (store?.ownerId?.toString() === userId) return true;
  return false;
};

// Actualizar una orden (ej. status)
const updateOrder = async (req, res) => {
  try {
    const { status } = req.body;
    // Si se está actualizando el status, registrar la fecha
    const updateData = { ...req.body };

    if (
      !isUserAdmin({
        userId: req.user.id,
        order: await Order.findById(req.params.id),
      })
    ) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para actualizar esta orden" });
    }

    if (status) {
      updateData[`statusDates.${status}`] = new Date();
    }

    console.log("🔄 updateOrder - Datos a actualizar:", updateData);
    console.log(
      "🔄 updateOrder - Orden ID:",
      req.params.id,
      "Usuario ID:",
      req.user.id
    );

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id },
      updateData,
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Error actualizando la orden", details: err.message });
  }
};

// Eliminar una orden (soft delete)
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user.id },
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
  getAdminOrders,
};
