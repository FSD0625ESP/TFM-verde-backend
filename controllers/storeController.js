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
    const stores = await Store.find({})
      .populate("categories", "name")
      .populate("ownerId", "firstName lastName email");
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

// Search stores with filters and pagination
const searchStoresFunction = async (
  page = 1,
  text = "",
  categories = [],
  minRating = 0,
  maxRating = 5
) => {
  const limit = 20;
  const query = { deletedAt: { $exists: false } };

  // normalize numeric params
  const pageNum = Number(page) || 1;


  if (text) {
    // name or description contains text (case-insensitive)
    query.$or = [
      { name: { $regex: `^${text}$`, $options: "i" } },
      { name: { $regex: `.*${text}.*`, $options: "i" } },
      { description: { $regex: `^${text}$`, $options: "i" } },
      { description: { $regex: `.*${text}.*`, $options: "i" } },
    ];
  }

  // categories — accept array or comma-separated string
  if (categories) {
    const cats = Array.isArray(categories)
      ? categories
      : typeof categories === "string"
        ? categories.split(",")
        : [];


    // convert to ObjectId instances if possible
    const catObjectIds = cats
      .filter((c) => c !== undefined && c !== null && String(c).trim() !== "")
      .map((c) => {
        try {
          const cleanId = String(c).trim();
          return new mongoose.Types.ObjectId(cleanId);
        } catch (err) {
          console.log(
            "[Backend] Error converting category to ObjectId:",
            c,
            err.message
          );
          return null;
        }
      })
      .filter(Boolean);

    if (catObjectIds.length > 0) {
      // Use $in for stores that match ANY of the selected categories
      query.categories = { $in: catObjectIds };
    }
  }
  const stores = await Store.find(query)
    .populate("categories", "name")
    .populate("ownerId", "firstName lastName email profileImage")
    .limit(limit)
    .skip((pageNum - 1) * limit);
  return stores;
};

const searchStores = async (req, res) => {
  console.debug("[Backend] Received search request for stores");
  console.debug("[Backend] Raw query params:", req.query);

  try {
    const { page, text, categories, minRating, maxRating } = req.query;
    const stores = await searchStoresFunction(
      page,
      text,
      categories,
      minRating,
      maxRating
    );
    console.log(`[Backend] Found ${stores.length} stores`);
    return res.status(200).json(stores);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllStores,
  registerStore,
  searchStoresFunction,
  searchStores,
  getStoreById,
  getStoreBySellerId,
};
