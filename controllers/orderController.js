const Order = require("../models/order");
const mongoose = require("mongoose");
const Address = require("../models/address");
const Delivery = require("../models/delivery");
const Store = require("../models/store");
const { geocodeAddress, getRoute, interpolateRoute, hasToken } = require("../services/mapbox");

const WAREHOUSE_ADDRESS = "Carrer de Mèxic, 17, 4, Sants-Montjuïc, 08004 Barcelona";

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
    const storeId = await Store.findOne({ ownerId: req.user.id }).select("_id").lean();
    if (!storeId) {
      console.log("❗ Tienda no encontrada para el usuario:", req.user.id);
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    // Parámetros de paginación y ordenación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';

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
      const searchRegex = new RegExp(search, 'i');

      // Buscar usuarios que coincidan con nombre, apellido o email
      const matchingUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id').lean();

      const userIds = matchingUsers.map(u => u._id);

      // Construir array de condiciones de búsqueda
      const orConditions = [
        { status: searchRegex },
        { customerId: { $in: userIds } }
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
      Order.countDocuments(filter)
    ]);

    console.log("📦 Órdenes encontradas:", orders.length, "de", total);

    res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("❌ Error en getAdminOrders:", err);
    res.status(500).json({ error: "Error obteniendo las órdenes", details: err.message });
  }
};

// Obtener una orden por ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customerId: req.user.id,
    })
      .populate("items.productId")
      .populate("addressId");

    if (!order) {
      console.log("❗ Orden no encontrada en DB para id:", req.params.id);
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    // Comprobar que el usuario autenticado es el propietario
    if (order.customerId.toString() !== req.user.id.toString()) {
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
const createOrder = async (req, res) => {
  try {
    const { customerId, storeId, addressId, items } = req.body;

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
    if (!storeId) {
      return res.status(400).json({ message: "storeId es requerido" });
    }
    if (!addressId) {
      return res.status(400).json({ message: "addressId es requerido" });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "items no puede estar vacío" });
    }

    const order = await Order.create({
      customerId,
      storeId,
      addressId,
      items,
      statusDates: {
        pending: new Date(),
      },
    });

    // Crear delivery simulado (dev) para tracking en tiempo real
    // - Origen: dirección hardcoded (almacén)
    // - Destino: addressId del pedido
    try {
      const address = await Address.findById(addressId).lean();
      if (address) {
        const destinationText = `${address.street}, ${address.postalCode} ${address.city}, ${address.state}, ${address.country || "España"}`;

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
          route = hasToken() ? await getRoute({ origin, destination }) : interpolateRoute({ origin, destination, steps: 40 });
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

    console.log("✅ Orden creada:", order._id);
    res.status(201).json(order);
  } catch (err) {
    console.error("❌ Error creando la orden:", err);
    res.status(500).json({
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
}

// Actualizar una orden (ej. status)
const updateOrder = async (req, res) => {
  try {
    const { status } = req.body;
    // Si se está actualizando el status, registrar la fecha
    const updateData = { ...req.body };

    if (!isUserAdmin({ userId: req.user.id, order: await Order.findById(req.params.id) })) {
      return res.status(403).json({ error: "No tienes permiso para actualizar esta orden" });
    }

    if (status) {
      updateData[`statusDates.${status}`] = new Date();
    }

    console.log("🔄 updateOrder - Datos a actualizar:", updateData);
    console.log("🔄 updateOrder - Orden ID:", req.params.id, "Usuario ID:", req.user.id);

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id },
      updateData,
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando la orden", details: err.message });
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
