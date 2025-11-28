const mongoose = require("mongoose");
const product = require("../models/product");

/* GET - /products/all
   Get all products
*/
const getAllProducts = async (req, res) => {
  try {
    const products = await product
      .find({})
      .populate("storeId", ["name", "logo"]);
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const getAllFeaturedProducts = async (req, res) => {
  try {
    const products = await product
      .find({ destacado: true })
      .populate("storeId", ["name", "logo"])
      .populate("categories", ["name"]);
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const getAllOfferProducts = async (req, res) => {
  try {
    const products = await product
      .find({ oferta: true })
      .populate("storeId", ["name", "logo"]);
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const productById = await product
      .findById(req.params.id)
      .populate("storeId", ["name", "logo"]);
    return res.status(200).json(productById);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// search products with filters and pagination
const searchProductsFunction = async (
  page = 1,
  text = "",
  categories = [],
  offer = undefined,
  min = 0,
  max = 1000
) => {
  const limit = 20;
  const query = { deletedAt: { $exists: false } };

  // normalize numeric params
  const pageNum = Number(page) || 1;
  const minNum = Number(min) || 0;
  const maxNum = Number(max) || 500;

  console.log("\n[Backend] Building MongoDB query");
  console.log("[Backend] Normalized params:", {
    pageNum,
    text,
    categories:
      typeof categories === "string" ? categories.split(",") : categories,
    offer,
    minNum,
    maxNum,
  });

  if (text) {
    // title or description contains text (case-insensitive)
    query.$or = [
      { title: { $regex: `^${text}$`, $options: "i" } },
      { title: { $regex: `.*${text}.*`, $options: "i" } },
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

    console.log("[Backend] Processing categories:", cats);

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
      // Use $in for products that match ANY of the selected categories
      query.categories = { $in: catObjectIds };
      console.log("[Backend] Added categories filter to query");
    }
  }

  // offer - solo aplicar el filtro si offer es true
  if (offer === "true" || offer === true) {
    query.oferta = true;
  }
  // si offer es false, no aplicamos filtro (muestra todos)

  // price between
  if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
    query.price = { $gte: minNum, $lte: maxNum };
  }


  const products = await product
    .find(query)
    .populate("storeId", ["name", "logo"])
    .populate("categories", ["name"])
    .limit(limit)
    .skip((pageNum - 1) * limit);

  return products;
};

const searchProducts = async (req, res) => {

  try {
    const { page, text, categories, offer, min, max } = req.query;
    const products = await searchProductsFunction(
      page,
      text,
      categories,
      offer,
      min,
      max
    );
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
  getProductById,
  searchProductsFunction,
  searchProducts,
};
