const Order = require("../models/order");
const mongoose = require("mongoose");

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
    });

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
