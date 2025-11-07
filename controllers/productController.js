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
      .populate("storeId", ["name", "logo"]);
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


// search products with filters and pagination
const searchProductsFunction = async (categories, offer, min, max, page = 1, text) => {
  const limit = 20;
  const query = { deletedAt: { $exists: false } };
  console.log("text", text);
  console.log("categories", categories);

  if (text) {
    // title contains text
    query.$or = [
      { title: { $regex: `^${text}$`, $options: 'i' } },
      { title: { $regex: `.*${text}.*`, $options: 'i' } },
      { description: { $regex: `^${text}$`, $options: 'i' } },
      { description: { $regex: `.*${text}.*`, $options: 'i' } },
    ];

  };

  // categories — array de ObjectId → que contenga todas las que pediste
  if (categories) {
    // aceptar ambos: array o string coma
    const cats = Array.isArray(categories)
      ? categories
      : categories.split(',');

    query.categories = { $all: cats };
  }

  // offer
  if (offer !== undefined) {
    query.oferta = offer === 'true';
  }

  // price between
  // formato esperado:  "min-max"
  if (min && max) {
    query.price = { $gte: min, $lte: max };
  }

  const products = await product
    .find(query)
    .populate("storeId", ["name", "logo"])
    .limit(limit)
    .skip((page - 1) * limit);

  return products;
};

const searchProducts = async (req, res) => {
  try {
    const { categories, offer, price, page, text } = req.query;
    const products = await searchProductsFunction(categories, offer, price, page, text);
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};




module.exports = {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
  searchProductsFunction,
  searchProducts
};
