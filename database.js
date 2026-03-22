require('dotenv').config();
const dns = require('dns');
const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGO_URI_ENV;
dns.setServers(['8.8.8.8', '8.8.4.4']);

const conexionDB = async () => {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("Conectado a la base de datos MongoDB"))
        .catch((err) => console.error("Error al conectar con MongoDB:", err));
};

module.exports = conexionDB;