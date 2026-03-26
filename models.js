const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    correo: { type: String, required: true, unique: true },
    contraseña: { type: String, required: true },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
    cryptoIv: { type: String, required: true },
    cryptoSalt: { type: String, required: true }
});

const usuario = mongoose.model("user", UserSchema, "Usuarios");

module.exports = { usuario };