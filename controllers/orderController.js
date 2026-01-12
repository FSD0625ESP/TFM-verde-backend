const Order = require("../models/order");
const mongoose = require("mongoose");

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

// Obtener una orden por ID
const getOrderById = async (req, res) => {
  try {
    console.log("🔍 getOrderById - params.id:", req.params.id);

    // Verificar autenticación
    if (!req.user || !req.user.id) {
      console.log("🔒 getOrderById - petición no autenticada");
      return res.status(401).json({ error: "No autenticado" });
    }

    console.log("🔍 getOrderById - req.user.id:", req.user.id);

    // Buscar la orden por _id primero
    let order = await Order.findById(req.params.id)
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
    const { status } = req.body;

    // Si se está actualizando el status, registrar la fecha
    const updateData = { ...req.body };
    if (status) {
      updateData[`statusDates.${status}`] = new Date();
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user.id },
      updateData,
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
};
