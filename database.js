const mongoose = require("mongoose");
const MONGO_URI = "mongodb+srv://jpa0024:C2738btv@mongodb.jcp5b.mongodb.net/Chat";

const conexionDB = async () => {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("Conectado a la base de datos MongoDB"))
        .catch((err) => console.error("Error al conectar con MongoDB:", err));
};

module.exports = conexionDB;