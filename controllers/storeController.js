const mongoose = require("mongoose");
const Store = require("../models/store");
const Product = require("../models/product");
const { uploadImage } = require("./uploadController");

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
   Get all stores where active is true
*/
const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find({ active: true })
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
    const store = await Store.findOne({ ownerId: req.params.id })
      .populate("categories", "name")
      .populate("ownerId", "firstName lastName email profileImage");
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

/* PATCH - /stores/update/:storeId/:userId
   Update a store by ID - only the owner can update
*/
const updateStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }
    if (store.ownerId.toString() !== req.params.userId) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para editar esta tienda" });
    }
    const updatedStore = await Store.findByIdAndUpdate(storeId, req.body, {
      new: true,
    });
    return res
      .status(200)
      .json({ msg: `Producto actualizado`, store: updatedStore });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Error al actualizar el producto", error: error.message });
  }
};

// Search stores with filters and pagination
// GET - /stores/search
// solo mostrar stores activas (active: true)
const searchStoresFunction = async (
  page = 1,
  text = "",
  categories = [],
  minRating = 0,
  maxRating = 5
) => {
  const limit = 20;
  const query = {
    deletedAt: { $exists: false },
    active: true,
  };

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

  // Ejecutar ambas queries en paralelo
  const [stores, totalCount] = await Promise.all([
    Store.find(query)
      .populate("categories", "name")
      .populate("ownerId", "firstName lastName email profileImage")
      .limit(limit)
      .skip((pageNum - 1) * limit),
    Store.countDocuments(query),
  ]);

  return { stores, total: totalCount };
};

const searchStores = async (req, res) => {
  console.debug("[Backend] Received search request for stores");
  console.debug("[Backend] Raw query params:", req.query);

  try {
    const { page, text, categories, minRating, maxRating } = req.query;
    const result = await searchStoresFunction(
      page,
      text,
      categories,
      minRating,
      maxRating
    );

    console.log(
      `[Backend] Found ${result.stores.length} stores, total: ${result.total}`
    );
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* ============================================
   APARIENCIA DE TIENDA
   ============================================ */

/* GET - /stores/:storeId/appearance
   Get store appearance (public)
*/
const getStoreAppearance = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId).select("appearance image name");

    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }

    res.status(200).json({
      appearance: store.appearance,
      image: store.image,
      name: store.name,
    });
  } catch (error) {
    console.error("Error getting store appearance:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* PATCH - /stores/:storeId/appearance
   Update store appearance
*/
const updateStoreAppearance = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      showFeaturedSection,
      showOfferSection,
      sectionsOrder,
      showSlider,
      sliderImages,
    } = req.body;

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }

    if (store.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para editar esta tienda" });
    }

    if (showFeaturedSection !== undefined) {
      store.appearance.showFeaturedSection = showFeaturedSection;
    }
    if (showOfferSection !== undefined) {
      store.appearance.showOfferSection = showOfferSection;
    }
    if (showSlider !== undefined) {
      store.appearance.showSlider = showSlider;
    }

    if (sectionsOrder !== undefined) {
      if (!Array.isArray(sectionsOrder)) {
        return res.status(400).json({ msg: "sectionsOrder debe ser un array" });
      }
      const normalized = sectionsOrder.map((v) => String(v).trim());
      const allowed = new Set(["featured", "offers"]);
      const isValidLength = normalized.length === 2;
      const isValidValues = normalized.every((v) => allowed.has(v));
      const isUnique = new Set(normalized).size === normalized.length;
      if (!isValidLength || !isValidValues || !isUnique) {
        return res
          .status(400)
          .json({
            msg: "sectionsOrder debe ser ['featured','offers'] (en el orden que quieras)",
          });
      }
      store.appearance.sectionsOrder = normalized;
    }

    if (sliderImages !== undefined) {
      if (!Array.isArray(sliderImages)) {
        return res.status(400).json({ msg: "sliderImages debe ser un array" });
      }
      if (sliderImages.length > 10) {
        return res.status(400).json({ msg: "Máximo 10 imágenes en el slider" });
      }
      const allStrings = sliderImages.every(
        (v) => typeof v === "string" && v.trim().length > 0
      );
      if (!allStrings) {
        return res
          .status(400)
          .json({ msg: "sliderImages debe ser un array de URLs (string)" });
      }

      store.appearance.sliderImages = sliderImages;
    }

    await store.save();

    res.status(200).json({
      msg: "Apariencia actualizada correctamente",
      appearance: store.appearance,
    });
  } catch (error) {
    console.error("Error updating store appearance:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* POST - /stores/:storeId/image
   Upload store featured image or logo
*/
const uploadStoreImage = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { type } = req.body; // "image" o "logo"

    if (!req.file) {
      return res.status(400).json({ msg: "No se subió archivo" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }

    if (store.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No tienes permiso" });
    }

    // Use uploadImage from uploadController (uses cloudinary)
    const result = await uploadImage(
      req.file.path,
      `stores/${storeId}/${type || "image"}`
    );

    // Guardar en el campo correcto según el tipo
    if (type === "logo") {
      store.logo = result.secure_url;
    } else {
      store.image = result.secure_url;
    }

    await store.save();

    res.status(200).json({
      msg: `${type === "logo" ? "Logo" : "Imagen"} subida correctamente`,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Error uploading store image:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* POST - /stores/:storeId/slider
   Upload image to store slider
*/
const uploadSliderImage = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!req.file) {
      return res.status(400).json({ msg: "No se subió archivo" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }

    if (store.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No tienes permiso" });
    }

    // Use uploadImage from uploadController
    const result = await uploadImage(req.file.path, `stores/${storeId}/slider`);

    store.appearance.sliderImages.push(result.secure_url);
    await store.save();

    res.status(200).json({
      msg: "Imagen agregada al slider",
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Error uploading slider image:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* DELETE - /stores/:storeId/slider/:imageUrl
   Delete image from store slider
*/
const deleteSliderImage = async (req, res) => {
  try {
    const { storeId, imageUrl } = req.params;
    const decodedUrl = decodeURIComponent(imageUrl);

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ msg: "Tienda no encontrada" });
    }

    if (store.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No tienes permiso" });
    }

    store.appearance.sliderImages = store.appearance.sliderImages.filter(
      (img) => img !== decodedUrl
    );

    await store.save();

    res.status(200).json({
      msg: "Imagen eliminada del slider",
      sliderImages: store.appearance.sliderImages,
    });
  } catch (error) {
    console.error("Error deleting slider image:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* ============================================
   PRODUCTOS DESTACADOS Y OFERTAS
   ============================================ */

/* GET - /stores/:storeId/featured-products
   Get featured products from store
*/
const getFeaturedProducts = async (req, res) => {
  try {
    const { storeId } = req.params;

    const products = await Product.find({
      storeId: storeId,
      destacado: true,
      deletedAt: { $exists: false },
    })
      .populate("storeId", "name logo slug")
      .populate("categories", "name");

    res.status(200).json({
      products: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error getting featured products:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /stores/:storeId/offer-products
   Get offer products from store
*/
const getOfferProducts = async (req, res) => {
  try {
    const { storeId } = req.params;

    const products = await Product.find({
      storeId: storeId,
      oferta: true,
      deletedAt: { $exists: false },
    })
      .populate("storeId", "name logo slug")
      .populate("categories", "name");

    res.status(200).json({
      products: products,
      count: products.length,
    });
  } catch (error) {
    console.error("Error getting offer products:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* PATCH - /stores/products/:productId/featured
   Mark/unmark product as featured
*/
const toggleProductFeatured = async (req, res) => {
  try {
    const { productId } = req.params;
    const { destacado } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const store = await Store.findById(product.storeId);
    if (store.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para editar este producto" });
    }

    product.destacado = destacado === true;
    await product.save();

    res.status(200).json({
      msg: `Producto ${destacado ? "marcado" : "desmarcado"} como destacado`,
      product: product,
    });
  } catch (error) {
    console.error("Error updating product featured:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* PATCH - /stores/products/:productId/offer
   Update product offer status
*/
const toggleProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const { oferta } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const store = await Store.findById(product.storeId);
    if (store.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para editar este producto" });
    }

    product.oferta = oferta === true;
    await product.save();

    res.status(200).json({
      msg: `Producto ${oferta ? "marcado" : "desmarcado"} como en oferta`,
      product: product,
    });
  } catch (error) {
    console.error("Error updating product offer:", error);
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllStores,
  registerStore,
  updateStoreById,
  searchStoresFunction,
  searchStores,
  getStoreById,
  getStoreBySellerId,
  getStoreAppearance,
  updateStoreAppearance,
  uploadStoreImage,
  uploadSliderImage,
  deleteSliderImage,
  getFeaturedProducts,
  getOfferProducts,
  toggleProductFeatured,
  toggleProductOffer,
};
