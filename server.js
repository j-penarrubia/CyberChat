const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const conexionDB = require("./database");
const { usuario } = require("./models");
const path = require("path");
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');
require('dotenv').config();

const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();
const mongoSanitize = require('express-mongo-sanitize');

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
const server = http.createServer(app);
const io = new Server(server);

app.use(session({
    secret: process.env.SECRET || 'secreto_desarrollo',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI_ENV,
        collectionName: 'session'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    }
}));

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

conexionDB();

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/public/index.html"));
});

app.get("/redir_registro", (req, res) => {
    res.sendFile(path.join(__dirname, "/public/registro.html"));
});

// ==========================================
// REGISTRO
// ==========================================
app.post("/registro", async (req, res) => {
    try {
        // Ahora esperamos recibir todas las variables criptográficas desde el frontend
        var { nombre, correo, contraseña, publicKey, privateKey, cryptoIv, cryptoSalt } = req.body;

        if (!nombre || !correo || !contraseña || !publicKey || !privateKey || !cryptoIv || !cryptoSalt) {
            return res.status(400).json({ error: "Faltan datos obligatorios o parámetros criptográficos." });
        }

        contraseña = await bcrypt.hash(contraseña, saltRounds);

        const nuevoUsuario = new usuario({
            nombre,
            correo,
            contraseña,
            publicKey,
            privateKey,
            cryptoIv,
            cryptoSalt
        });

        await nuevoUsuario.save();

        res.status(201).json({ message: "Usuario registrado exitosamente." });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: "El nombre o correo ya están registrados." });
        } else {
            console.error("Error al registrar usuario:", error);
            res.status(500).json({ error: "Ocurrió un error al registrar el usuario." });
        }
    }
});

// ==========================================
// LOGIN
// ==========================================
app.post("/login", async (req, res) => {
    try {
        const { user, password } = req.body;

        const criterioBusqueda = { $or: [{ correo: user }, { nombre: user }] };
        const resultado = await usuario.findOne(criterioBusqueda);

        if (!resultado) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        if (await bcrypt.compare(password, resultado.contraseña)) {
            if (listaUsuarios[resultado.nombre]) {
                return res.status(401).json({ error: "Este usuario ya está conectado" });
            }

            res.cookie('nombreUsuario', resultado.nombre, {
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
            });

            req.session.usuario = resultado.nombre;
            
            req.session.save((err) => {
                if (err) {
                    console.error("Error al guardar la sesión en Mongo:", err);
                    return res.status(500).json({ error: "Error interno guardando sesión" });
                }

                res.status(200).json({
                    message: "Inicio de sesión exitoso",
                    usuario: {
                        nombre: resultado.nombre,
                        publicKey: resultado.publicKey,
                        privateKey: resultado.privateKey,
                        cryptoIv: resultado.cryptoIv,
                        cryptoSalt: resultado.cryptoSalt
                    }
                });
            }); 

        } else {
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

    } catch (error) {
        console.error("Error en /login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ==========================================
// CERRAR SESIÓN
// ==========================================
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
            return res.status(500).send('Error al cerrar sesión.');
        }
        res.clearCookie('nombreUsuario');
        res.clearCookie('connect.sid');
        res.send('Sesión cerrada exitosamente.');
    });
});

app.get('/chat', verificarAutenticacion, (req, res) => {
    res.sendFile(path.join(__dirname, "/public/chat.html"));
});

function verificarAutenticacion(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.status(401).send('Acceso denegado. Por favor inicia sesión.');
    }
}

// ==========================================
// SOCKET.IO (Chat y Criptografía)
// ==========================================
let listaUsuarios = {};

io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado:', socket.id);

    socket.on('asignarUsuario', async (data) => {
        try {
            const userDB = await usuario.findOne({ nombre: data.nombre });

            if (userDB) {
                listaUsuarios[data.nombre] = {
                    id: socket.id,
                    publicKey: userDB.publicKey
                };
                console.log(`Usuario asignado: ${data.nombre} (Clave pública cargada de BD)`);
                io.emit('actualizar lista', Object.keys(listaUsuarios));
            }
        } catch (err) {
            console.error("Error al asignar usuario en Socket:", err);
        }
    });

    socket.on('pedirClave', (nombreDestinatario, callback) => {
        const usuarioActivo = listaUsuarios[nombreDestinatario];

        if (usuarioActivo && usuarioActivo.publicKey) {
            callback({ success: true, publicKey: usuarioActivo.publicKey });
        } else {
            callback({ success: false, error: "Usuario desconectado o sin clave pública." });
        }
    });

    socket.on('mensajePublico', (msg) => {
        io.emit('mensajePublico', msg);
    });

    socket.on('mensajePrivado', (msg) => {
        const receptorData = listaUsuarios[msg.receptor];

        if (receptorData) {
            socket.to(receptorData.id).emit('mensajePrivado', msg);
            console.log(`Mensaje transferido de ${msg.emisor} a ${msg.receptor}. Mensaje: ${msg.mensaje}`);
        } else {
            console.log(`Fallo al enviar: ${msg.receptor} no está conectado.`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Un cliente se ha desconectado:', socket.id);

        for (const nombre in listaUsuarios) {
            if (listaUsuarios[nombre].id === socket.id) {
                delete listaUsuarios[nombre];
                console.log(`Usuario eliminado de lista activa: ${nombre}`);
                break;
            }
        }

        io.emit('actualizar lista', Object.keys(listaUsuarios));
    });
});