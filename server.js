const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const conexionDB = require("./database");
const { usuario } = require("./models");
const path = require("path");

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
        const { nombre, correo, contraseña } = req.body;

        // Validar los datos recibidos
        if (!nombre || !correo || !contraseña) {
            return res.status(400).json({ error: "Todos los campos son obligatorios." });
        }

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
        const criterioBusqueda = {
            $and: [
                { contraseña: password },
                { $or: [{ correo: user }, { nombre: user }] }
            ]
        };
        const resultado = await usuario.findOne(criterioBusqueda);
        console.log(resultado);

        if (resultado) {

            //Comprobamos la lista para ver si está conectado
            if (listaUsuarios[resultado.nombre]) {
                res.status(401).json({ error: "Este usuario ya está conectado" });
            }

            // Usuario encontrado en la base de datos y no conectado.
            res.cookie('nombreUsuario', resultado.nombre, {
                secure: false,   // Cambia a true si usas HTTPS
                sameSite: 'Strict' // Protección CSRF
            });

            res.status(200).json({ message: "Inicio de sesión exitoso", usuario: resultado });

            //Aquí redirigimos a la página del chat, además hay que logearlo al server.io

        } else {
            // Usuario no encontrado
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            //Aquí colgamos un mensaje indicando el error

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
    })

});