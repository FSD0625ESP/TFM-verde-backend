const mongoose = require("mongoose");
const Store = require("../models/store");

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





module.exports = {
  getAllStores,
  registerStore
};
