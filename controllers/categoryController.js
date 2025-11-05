const mongoose = require("mongoose");
const Category = require("../models/category");

/* GET - /categories/all
   Get all categories
*/
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    return res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllCategories,
};
