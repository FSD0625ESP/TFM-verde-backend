const mongoose = require("mongoose");
const Store = require("../models/store");

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

/* GET - /stores/all
   Get all stores
*/
const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find({});
    return res.status(200).json(stores);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /stores/store/:id
   Get a store by ID
*/
const getStoreById = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    return res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /stores/store/seller/:id
   Get a store by seller ID
*/
const getStoreBySellerId = async (req, res) => {
  try {
    const store = await Store.findOne({ ownerId: req.params.id });
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }
    return res.status(200).json(store);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* POST - /stores/register
   Register a new store
*/
const registerStore = async (req, res) => {
  try {
    const { name, description, ownerId, billingInfo } = req.body;
    const slug = generateSlug(name);
    const newStore = new Store({
      name,
      slug,
      description,
      ownerId,
      billingInfo,
    });
    await newStore.save();
    return res.status(200).json(newStore);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllStores,
  getStoreById,
  getStoreBySellerId,
  registerStore,
};
