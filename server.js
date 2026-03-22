
const express = require('express');

const http = require('http');
const { Server } = require('socket.io');
const conexionDB = require("./database");

const { usuario } = require("./models");
const path = require("path");

const session = require('express-session');

require('dotenv').config();

//Importaciones para encriptar y desencriptar contraseñas
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
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
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

app.post("/registro", async (req, res) => {
    try {
        var { nombre, correo, contraseña } = req.body;

        if (!nombre || !correo || !contraseña) {
            return res.status(400).json({ error: "Todos los campos son obligatorios." });
        }

        contraseña = await bcrypt.hash(contraseña, saltRounds);

        const nuevoUsuario = new usuario({ nombre, correo, contraseña });
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

app.post("/login", async (req, res) => {
    try {
        const { user, password } = req.body;
        console.log(user, password);

        const criterioBusqueda = { $or: [{ correo: user }, { nombre: user }] };
        const resultado = await usuario.findOne(criterioBusqueda);
        console.log(resultado);

        if (!resultado) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        if (await bcrypt.compare(password, resultado.contraseña)) {

            if (listaUsuarios[resultado.nombre]) {
                return res.status(401).json({ error: "Este usuario ya está conectado" });
            }

            res.cookie('nombreUsuario', resultado.nombre, {
                secure: true,
                sameSite: 'Strict',
            });

            req.session.usuario = resultado.nombre;
            res.status(200).json({ message: "Inicio de sesión exitoso", usuario: resultado });

        } else {
            const existe = await usuario.findOne({ $or: [{ correo: user }, { nombre: user }] });
            if (existe) {
                res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }
        }

    } catch (error) {
        console.error("Error en /login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

//Cerrar Sesión
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
            return res.status(500).send('Error al cerrar sesión.');
        }
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

let listaUsuarios = {};

io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado:', socket.id);

    // 1. Asignar usuario guardando su clave pública
    socket.on('asignarUsuario', (data) => {
        listaUsuarios[data.nombre] = {
            id: socket.id,
            publicKey: data.publicKey
        };
        console.log(`Usuario asignado: ${data.nombre} (Clave recibida)`);
        
        io.emit('actualizar lista', Object.keys(listaUsuarios));
    });

    // 2. Evento para servir la clave pública de un usuario a otro
    socket.on('pedirClave', (nombreDestinatario, callback) => {
        const usuario = listaUsuarios[nombreDestinatario];
        
        if (usuario && usuario.publicKey) {
            callback({ success: true, publicKey: usuario.publicKey });
        } else {
            callback({ success: false, error: "Usuario desconectado o sin clave pública." });
        }
    });

    // 3. Escuchar mensajes públicos y difundirlos (Sin cifrar)
    socket.on('mensajePublico', (msg) => {
        io.emit('mensajePublico', msg);
    });

    // 4. Reenviar Mensaje Privado (Cifrado E2EE)
    socket.on('mensajePrivado', (msg) => {
        const receptorData = listaUsuarios[msg.receptor];
        
        if (receptorData) {
            socket.to(receptorData.id).emit('mensajePrivado', msg);
            console.log(`Mensaje transferido de ${msg.emisor} a ${msg.receptor}. Mensaje encriptado: ${msg.mensaje}`);
        } else {
            console.log(`Fallo al enviar: ${msg.receptor} no está conectado.`);
        }
    });

    // 5. Desconexión de usuario
    socket.on('disconnect', () => {
        console.log('Un cliente se ha desconectado:', socket.id);
        
        for (const nombre in listaUsuarios) {
            if (listaUsuarios[nombre].id === socket.id) {
                delete listaUsuarios[nombre];
                console.log(`Usuario eliminado: ${nombre}`);
                break;
            }
        }
        
        io.emit('actualizar lista', Object.keys(listaUsuarios));
    });
});