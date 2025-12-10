const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { setupSocketIO } = require("./services/socket");

// Cargar variables de entorno primero
require("dotenv").config();

// Middlewares globales
const cors = require("cors");
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);



// Importar rutas
const userRoutes = require("./routes/users");
const addressRoutes = require("./routes/addresses");
const storeRoutes = require("./routes/stores");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const reviewRoutes = require("./routes/reviews");
const chatRoutes = require("./routes/chats");
const uploadRoutes = require("./routes/uploads");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const mongoose = require("mongoose");
require("dotenv").config();

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Cambia esto a la URL de tu frontend
    credentials: true, // Habilita el envío de cookies
  })
);

// Configurar Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

require("dotenv").config();
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/users", userRoutes);
app.use("/addresses", addressRoutes);
app.use("/stores", storeRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/reviews", reviewRoutes);
app.use("/chats", chatRoutes);
app.use("/cart", cartRoutes);
app.use("/uploads", uploadRoutes);
app.use("/orders", orderRoutes);

// ========== SOCKET.IO SETUP ==========
setupSocketIO(io);

// Exportar io para usar en otros módulos si es necesario
app.set("io", io);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`🌐 HTTP Server: http://localhost:${port}`);
  console.log(`🔌 Socket.IO ready on: http://localhost:${port}`);
});
