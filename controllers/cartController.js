const Cart = require("../models/cart");
const Product = require("../models/product");

//
// 📌 Obtener el carrito del usuario
//
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.query.sessionId || null;
    if (!userId && !sessionId)
      return res.status(401).json({ message: "Usuario no autenticado" });

    console.log("💡 User ID in getCart:", userId);

    // Si hay userId, buscar SOLO por userId (usuarios logueados)
    // Si NO hay userId, buscar por sessionId (usuarios anónimos)
    const query = userId
      ? { userId }
      : { sessionId, userId: null };

    const cart = await Cart.findOne(query).populate(
      "items.productId",
      "title images price _id storeId"
    );

    if (!cart) {
      return res.json({ items: [], total: 0 });
    }

    console.log(
      "🛒 Contenido del carrito:",
      cart.items.map((i) => i.productId?._id.toString())
    );

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener carrito", error: err });
  }
};

const isPosibleAddToCartProduct = (cart, newProductId) => {
  // si tienes productos de otra tienda no puedes añadir
  if (cart.items.length === 0) return true;

  const Product = require("../models/product");
  const existingProductId = cart.items[0].productId;
  console.log("🛒 Verificando tienda del producto existente en el carrito:", existingProductId);
  return Product.findById(existingProductId).then((existingProduct) => {
    return Product.findById(newProductId).then((newProduct) => {
      if (!existingProduct || !newProduct) return false;
      return existingProduct.storeId.toString() === newProduct.storeId.toString();
    });
  });
  return false;

};


//
// 📌 Agregar producto al carrito, con user id si esta logueado o session id en caso que no
//
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, sessionId = null } = req.body;
    const userId = req.user?.id;

    if (!userId && !sessionId)
      return res.status(401).json({ message: "Usuario no autenticado" });
    if (!productId)
      return res.status(400).json({ message: "productId es obligatorio" });

    let cart = await Cart.findOne({ userId: userId || null, sessionId: sessionId || null });

    if (!cart) {
      cart = new Cart({ userId: userId || null, sessionId: sessionId || null, items: [] });
    }
    const canAdd = await isPosibleAddToCartProduct(cart, productId);
    if (!canAdd) {
      return res.status(400).json({ message: "No puedes añadir productos de diferentes tiendas al carrito" });
    }
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    // Recalcular total
    let total = 0;
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) total += product.price * item.quantity;
    }
    cart.total = total;

    await cart.save();
    //Populamos el carrito para fronted antes de enviarlo
    cart = await cart.populate(
      "items.productId",
      "title images price _id storeId"
    );
    res.json(cart);
  } catch (err) {
    console.log("Error en addToCart:", err);
    res.status(500).json({
      message: "Error al agregar al carrito",
      error: err,
    });
  }
};



//
// 📌 Actualizar cantidad de un producto
//
exports.updateItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });
    if (!productId)
      return res.status(400).json({ message: "productId es obligatorio" });

    let cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ message: "Carrito no encontrado" });

    const item = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    if (!item)
      return res
        .status(404)
        .json({ message: "Producto no encontrado en el carrito" });

    if (quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => i.productId.toString() !== productId
      );
    } else {
      item.quantity = quantity;
    }

    // Recalcular total
    let total = 0;
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) total += product.price * item.quantity;
    }
    cart.total = total;

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({
      message: "Error al actualizar carrito",
      error: err,
    });
  }
};

//
// 📌 Eliminar un producto del carrito
//
exports.removeItem = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    console.log(
      "🗑️ removeItem recibido - productId:",
      productId,
      "quantity:",
      quantity
    );

    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });
    if (!productId)
      return res.status(400).json({ message: "productId es obligatorio" });

    let cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ message: "Carrito no encontrado" });

    console.log("📦 Carrito encontrado, items antes:", cart.items.length);

    //Modificamos la cantidad del producto especificada o eliminamos el item si la cantidad es mayor o igual a la existente
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    console.log("🔍 Item index:", itemIndex);

    if (itemIndex !== -1) {
      const item = cart.items[itemIndex];
      const newQuantity = item.quantity - quantity;

      // Si la nueva cantidad es <= 0, eliminar el item completo
      if (newQuantity <= 0) {
        cart.items.splice(itemIndex, 1);
        console.log("🗑️ Item eliminado (cantidad sería <= 0)");
      } else {
        // Si aún queda cantidad, solo restar
        item.quantity = newQuantity;
        console.log("📉 Cantidad reducida a:", newQuantity);
      }
    }

    console.log("📦 Items después de modificar:", cart.items.length);

    // Recalcular total
    let total = 0;
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) total += product.price * item.quantity;
    }
    cart.total = total;

    console.log("💾 Guardando carrito...");
    await cart.save();

    console.log("📤 Recargando carrito con populate...");
    // Recargar y poplar el carrito para frontend antes de enviarlo
    cart = await Cart.findOne({ userId }).populate(
      "items.productId",
      "title images price _id storeId"
    );

    console.log("✅ removeItem completado exitosamente");
    res.json(cart);
  } catch (err) {
    console.log("❌ Error en removeItem:", err.message);
    console.log("Stack:", err.stack);
    res.status(500).json({
      message: "Error al eliminar del carrito",
      error: err.message,
    });
  }
};

//
// 📌 Vaciar carrito
//
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });

    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ message: "Carrito no encontrado" });

    cart.items = [];
    cart.total = 0;

    await cart.save();
    res.json({ message: "Carrito vaciado" });
  } catch (err) {
    res.status(500).json({
      message: "Error al vaciar carrito",
      error: err,
    });
  }
};

//
// 📌 Reemplazar carrito anónimo por carrito de usuario al hacer login
//
exports.replaceAnonymousCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    console.log("🔄 Reemplazando carrito anónimo por carrito de usuario", { userId, sessionId });

    // 1. Obtener carrito anónimo ANTES de eliminarlo
    let anonymousCart = null;
    if (sessionId) {
      anonymousCart = await Cart.findOne({ sessionId, userId: null });
      console.log("📦 Carrito anónimo encontrado:", anonymousCart?.items.length || 0, "items");
    }

    // 2. Buscar o crear carrito del usuario
    let userCart = await Cart.findOne({ userId });

    if (!userCart) {
      // Crear carrito con los items del anónimo (si existen)
      userCart = new Cart({
        userId,
        sessionId: null,
        items: anonymousCart?.items || [],
        total: anonymousCart?.total || 0
      });
      await userCart.save();
      console.log("✨ Carrito de usuario creado con", userCart.items.length, "items del anónimo");
    } else {
      // Usuario ya tenía carrito → transferir items del anónimo si existen
      if (anonymousCart && anonymousCart.items.length > 0) {
        userCart.items = anonymousCart.items;
        userCart.total = anonymousCart.total;
        await userCart.save();
        console.log("🔄 Items del carrito anónimo transferidos al carrito del usuario:", userCart.items.length, "items");
      } else {
        console.log("👤 Usuario ya tenía carrito con", userCart.items.length, "items → se mantiene");
      }
    }

    // 3. Eliminar carrito anónimo después de transferir items
    if (sessionId && anonymousCart) {
      await Cart.deleteOne({ sessionId, userId: null });
      console.log("🗑️ Carrito anónimo eliminado");
    }

    // 4. Retornar carrito del usuario con populate
    userCart = await Cart.findOne({ userId }).populate(
      "items.productId",
      "title images price _id storeId"
    );

    console.log("✅ Carrito de usuario cargado:", userCart.items.length, "items");
    res.json(userCart);
  } catch (err) {
    console.error("❌ Error reemplazando carrito:", err);
    res.status(500).json({
      message: "Error al reemplazar carrito",
      error: err.message
    });
  }
};
