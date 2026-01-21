const mongoose = require("mongoose");
const product = require("../models/product");
const store = require("../models/store");
const generateSlug = require("../utils/generateSlug");
const getActiveStoresIds = require("./storeController").getActiveStoresIds;

/* Función para verificar si el usuario puede ver el producto
// Si el usuario no está autenticado o no es el propietario, 
// solo verá productos de tiendas activas.
// Si el usuario es el propietario de la tienda, 
// podrá ver todos los productos de su tienda. 
*/
const canUserSeeProduct = (product, user) => {

  console.log("DATOS DE PRODUCTO", product);
  console.log("DATOS DE USUARIO", user);
  if (!product.storeId) return false;

  // tienda activa → visible para todos
  if (product.storeId.active) return true;

  // tienda inactiva → solo visible para el owner
  if (user && String(product.storeId.ownerId) === String(user.id)) {
    return true;
  }

  return false;
};

/* GET - /products/all
   Get all products
*/
const getAllProducts = async (req, res) => {
  try {
    const products = await product
      .find({})
      .populate("storeId", ["name", "slug", "logo"]);
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /products/store/:id
   Get all products by store id
*/
const getAllProductsByStoreId = async (req, res) => {
  try {
    const products = await product
      .find({ storeId: req.params.id })
      .populate("storeId", ["name", "slug"])
      .populate("categories", "name");
    return res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /products/featured
   Get all featured products
*/
const getAllFeaturedProducts = async (req, res) => {
  try {
    const products = await product
      .find({ destacado: true })
      .populate({
        path: "storeId",
        select: "name logo slug active ownerId",
      })
      .populate("categories", ["name"]);

    const filteredProducts = products.filter((p) =>
      canUserSeeProduct(p, req.user)
    );
    return res.status(200).json(filteredProducts);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /products/offer
   Get all offer products
*/
const getAllOfferProducts = async (req, res) => {
  try {
    const products = await product
      .find({ oferta: true })
      .populate({
        path: "storeId",
        select: "name logo slug active ownerId",
      })
      .populate("categories", ["name"]);

    const filteredProducts = products.filter((p) =>
      canUserSeeProduct(p, req.user)
    );
    return res.status(200).json(filteredProducts);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /products/product/:id
   Get product by id
*/
const getProductById = async (req, res) => {
  try {
    const foundProduct = await product
      .findById(req.params.id)
      .populate({
        path: "storeId",
        select: "name logo slug active ownerId",
      })
      .populate("categories", ["name"]);

    if (!foundProduct) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }
    console.log("DATOS DE PRODUCTO", foundProduct);
    console.log("DATOS DE USUARIO", req.user);
    if (!canUserSeeProduct(foundProduct, req.user)) {
      return res.status(403).json({
        msg: "No tienes permiso para ver este producto",
      });
    }

    return res.status(200).json(foundProduct);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* DELETE - /products/delete-product/:id/:userId
   Delete product by id - only owner can delete
*/
const deleteProductById = async (req, res) => {
  try {
    const productById = await product
      .findById(req.params.id)
      .populate("storeId", ["ownerId"]);

    if (!productById) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }
    if (productById.storeId.ownerId.toString() !== req.params.userId) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para eliminar este producto" });
    }

    await product.findByIdAndDelete(req.params.id);
    return res.status(200).json({ msg: "Producto eliminado" });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* PATCH - /products/update-product/:id
    Update product by id
*/
const updateProductById = async (req, res) => {
  try {
    const updatedProduct = await product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // Devuelve el documento actualizado
    );
    if (!updatedProduct) {
      return res.status(404).json({ msg: `Producto no encontrado` });
    }
    return res
      .status(200)
      .json({ msg: `Producto actualizado`, product: updatedProduct });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const searchProductsFunction = async (
  page = 1,
  text = "",
  categories = [],
  offer = undefined,
  stores = [],
  min = 0,
  max = 1000,
  user = null
) => {
  const limit = 20;
  const query = { deletedAt: { $exists: false } };

  // la tienda debe estar en estado "active"
  // (esto se aplica en el seed de productos y en la creación de productos nuevos)
  const activeStoreIds = await getActiveStoresIds();
  query.storeId = { $in: activeStoreIds };

  // normalize numeric params
  const pageNum = Number(page) || 1;
  const minNum = Number(min) || 0;
  const maxNum = Number(max) || 500;

  if (text) {
    const safeText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: safeText, $options: "i" } },
      { description: { $regex: safeText, $options: "i" } },
    ];
  }

  // categories — accept array or comma-separated string
  if (categories && categories.length > 0) {
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
      // Use $in for products that match ANY of the selected categories
      query.categories = { $in: catObjectIds };
    }
  }

  if (stores && stores.length > 0) {
    const strs = Array.isArray(stores)
      ? stores
      : typeof stores === "string"
        ? stores.split(",")
        : [];

    // convert to ObjectId instances if possible
    const storeObjectIds = strs
      .filter((s) => s !== undefined && s !== null && String(s).trim() !== "")
      .map((s) => {
        try {
          const cleanId = String(s).trim();
          return new mongoose.Types.ObjectId(cleanId);
        } catch (err) {
          console.log(
            "[Backend] Error converting store to ObjectId:",
            s,
            err.message
          );
          return null;
        }
      })
      .filter(Boolean);

    console.log("[Backend] Converted store ObjectIds:", storeObjectIds);

    if (storeObjectIds.length > 0) {
      // Use $in for products that match ANY of the selected stores
      query.storeId = { $in: storeObjectIds };
      console.log("[Backend] Added selected stores filter to query");
    } else {
      //si no hay tiendas seleccionadas
      //mostrar productos de todas las tiendas
      console.log(
        "[Backend] No stores selected, showing products from all stores"
      );
    }
  }

  // offer - solo aplicar el filtro si offer es true
  if (offer === "true" || offer === true) {
    query.oferta = true;
  }
  // si offer es false, no aplicamos filtro (muestra todos)

  // price between
  if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
    console.log("[Backend] Added price filter to query", minNum, maxNum);
    query.price = { $gte: minNum, $lte: maxNum };
  }

  // Ejecutar ambas queries en paralelo
  /*
  const [products, totalCount] = await Promise.all([
    product
      .find(query)
      //.populate("storeId", ["active", "name", "logo", "slug"])
      .populate({
        path: "storeId",
        select: "active name logo slug ownerId",
      })
      .populate("categories", ["name"])
      .limit(limit)
      .skip((pageNum - 1) * limit),
    product.countDocuments(query),
  ]);

  console.log("[Backend] Found products:", query);

  const filteredProducts = products.filter((p) => canUserSeeProduct(p, req));

  return {
    products: filteredProducts,
    total: filteredProducts.length,
  };
  */

  /* ---- 1️⃣ traer TODOS los productos que cumplen la query ---- */
  const allProducts = await product.find(query).populate({
    path: "storeId",
    select: "active ownerId",
  });

  /* ---- 2️⃣ filtrar por visibilidad ---- */
  const visibleProducts = allProducts.filter((p) => canUserSeeProduct(p, user));

  const total = visibleProducts.length;

  /* ---- 3️⃣ paginar SOBRE los visibles ---- */
  const paginatedProducts = visibleProducts
    .slice((pageNum - 1) * limit, pageNum * limit)
    .map((p) => p._id);

  /* ---- 4️⃣ volver a pedir SOLO los de la página (con populate completo) ---- */
  const products = await product
    .find({ _id: { $in: paginatedProducts } })
    .populate({
      path: "storeId",
      select: "name logo slug active ownerId",
    })
    .populate("categories", ["name"]);

  return {
    products,
    total,
  };
};

const searchProducts = async (req, res) => {
  try {
    const { page, text, categories, stores, offer, min, max } = req.query;
    const result = await searchProductsFunction(
      page,
      text,
      categories,
      offer,
      stores,
      min,
      max,
      req.user
    );
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const storeData = await store.findOne({ ownerId: req.user.id });
    let productData = {
      storeId: new mongoose.Types.ObjectId(storeData._id),
      slug: generateSlug(req.body.title),
      ...req.body,
    };
    const newProduct = new product(productData);
    console.log("newProduct", newProduct);
    const savedProduct = await newProduct.save();
    res.status(201).json({ savedProduct, productId: savedProduct._id });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /products/related/:id
   Get related products by category (multiple categories)
*/
const getRelatedProducts = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { categories = "", limit = 8 } = req.query;

    // Obtain the current product to verify it exists
    const currentProduct = await product.findById(productId);
    if (!currentProduct) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    // Parse categories - accept array or comma-separated string
    const categoryIds = Array.isArray(categories)
      ? categories
      : typeof categories === "string"
        ? categories.split(",")
        : [];

    // Convert to ObjectId instances
    const categoryObjectIds = categoryIds
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

    if (categoryObjectIds.length === 0) {
      return res.status(200).json([]);
    }

    // Get related products that share ANY of the categories, excluding the current product
    const relatedProducts = await product
      .find({
        _id: { $ne: productId },
        categories: { $in: categoryObjectIds },
        deletedAt: { $exists: false },
      })
      .populate({
        path: "storeId",
        select: "name logo slug active ownerId",
      })
      .populate("categories", ["name"]);

    const filteredProducts = relatedProducts.filter((p) =>
      canUserSeeProduct(p, req.user)
    );

    return res.status(200).json(filteredProducts);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllProducts,
  getAllProductsByStoreId,
  getAllFeaturedProducts,
  getAllOfferProducts,
  getProductById,
  deleteProductById,
  updateProductById,
  searchProductsFunction,
  searchProducts,
  createProduct,
  getRelatedProducts,
};
