const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const conexionDB = require("./database");
const { usuario } = require("./models");
const path = require("path");
require('dotenv').config();
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = new Server(server);

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

        // Validar los datos recibidos
        if (!nombre || !correo || !contraseña) {
            return res.status(400).json({ error: "Todos los campos son obligatorios." });
        }

        //Encriptar contraseña
        contraseña = await bcrypt.hash(contraseña, saltRounds);

        // Crear una nueva instancia del usuario
        const nuevoUsuario = new usuario({ nombre, correo, contraseña });

        // Guardar el usuario en la base de datos
        await nuevoUsuario.save();

        // Responder al cliente
        res.status(201).json({ message: "Usuario registrado exitosamente." });
    } catch (error) {
        if (error.code === 11000) {
            // Error por datos duplicados
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

        //Ponemos como condicional para hacer la comprobación que las contraseñas coincidan
        if (await bcrypt.compare(password, resultado.contraseña)) {

            //Comprobamos la lista para ver si está conectado
            if (listaUsuarios[resultado.nombre]) {
                return res.status(401).json({ error: "Este usuario ya está conectado" });
            }

            // Usuario encontrado en la base de datos y no conectado.
            res.cookie('nombreUsuario', resultado.nombre, {
                secure: false,   // Cambia a true si usas HTTPS
                sameSite: 'Strict' // Protección CSRF
            });

            res.status(200).json({ message: "Inicio de sesión exitoso", usuario: resultado });

            //Aquí redirigimos a la página del chat, además hay que logearlo al server.io

        } else {
            const existe = await usuario.findOne({ $or: [{ correo: user }, { nombre: user }] });
            if (existe) {
                res.status(401).json({ error: "Contraseña incorrecta" });
                //Aquí colgamos un mensaje indicando el error
            } else {
                // Usuario no encontrado
                res.status(401).json({ error: "Usuario no registrado" });
                //Aquí colgamos un mensaje indicando el error
            }

        }

    } catch (error) {
        console.error("Error en /login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

var listaUsuarios = {};

io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado:', socket.id);

    socket.on('asignarUsuario', (user) => {
        listaUsuarios[user] = socket.id;
        console.log(listaUsuarios);
        io.emit('actualizar lista', listaUsuarios);
    })

    // Escuchar mensajes publicos del cliente y difundirlos
    socket.on('mensajePublico', (msg) => {
        console.log(msg);
        // Reenviar el mensaje a todos los clientes
        io.emit('mensajePublico', msg);
    });

    //Reenviar Mensaje Privado
    socket.on('mensajePrivado', (msg) => {
        console.log(msg);
        const receptor = listaUsuarios[msg.receptor];
        console.log(receptor);
        //Podría funcionar
        socket.to(receptor).emit('mensajePrivado', msg);
        console.log(msg.emisor);
    });

    socket.on('disconnect', () => {
        console.log('Un cliente se ha desconectado:', socket.id);
        for (const nombre in listaUsuarios) {
            if (listaUsuarios[nombre] === socket.id) {
                delete listaUsuarios[nombre];
                break;
            }
        }
        // Enviar lista actualizada de usuarios a todos
        io.emit('actualizar lista', listaUsuarios);

    });

});