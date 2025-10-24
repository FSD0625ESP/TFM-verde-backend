const express = require("express");
const app = express();
const userRoutes = require("./routes/users");
const storeRoutes = require("./routes/stores");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

app.use(
    cors({
        origin: "http://localhost:5174", // Cambia esto a la URL de tu frontend
        credentials: true, // Habilita el envío de cookies
    })
);

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
app.use("/stores", storeRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
