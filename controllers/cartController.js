const Cart = require("../models/cart");
const Product = require("../models/product");

//
// 📌 Obtener el carrito del usuario
//
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });

    console.log("💡 User ID in getCart:", userId);

    const cart = await Cart.findOne({ userId }).populate(
      "items.productId",
      "title images price _id"
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

//
// 📌 Agregar producto al carrito
//
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });
    if (!productId)
      return res.status(400).json({ message: "productId es obligatorio" });

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
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
    cart = await cart.populate("items.productId", "title images price _id");
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

    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ message: "Usuario no autenticado" });
    if (!productId)
      return res.status(400).json({ message: "productId es obligatorio" });

    let cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ message: "Carrito no encontrado" });

    //Modificamos la cantidad del producto especificada o eliminamos el item si la cantidad es mayor o igual a la existente
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (itemIndex !== -1) {
      const item = cart.items[itemIndex];
      if (item.quantity > quantity) {
        item.quantity -= quantity;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    }

    // Recalcular total
    let total = 0;
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) total += product.price * item.quantity;
    }
    cart.total = total;

    await cart.save();

    // Populamos el carrito para frontend antes de enviarlo
    cart = await cart.populate("items.productId", "title images price _id");
    res.json(cart);
  } catch (err) {
    console.log("Error en removeItem:", err);
    res.status(500).json({
      message: "Error al eliminar del carrito",
      error: err,
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
