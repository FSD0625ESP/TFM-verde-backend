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

module.exports = {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
};
