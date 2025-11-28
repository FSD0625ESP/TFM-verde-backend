const mongoose = require("mongoose");
const Store = require("../models/store");

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

const registerStore = async (req, res) => {
  try {
    const { name, description, ownerId, billingInfo } = req.body;
    const newStore = new Store({
      name,
      description,
      ownerId,
      billingInfo
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
  searchStores
};
