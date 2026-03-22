//Importaciones generales
const express = require('express');

const http = require('http');
const { Server } = require('socket.io');
const conexionDB = require("./database");
//Importación del modelo de usuario para MongoDB
const { usuario } = require("./models");
const path = require("path");

//Importación de la session
const session = require('express-session');

//Importamos el dotenv para poder acceder a variables de entorno
require('dotenv').config();

//Importaciones para encriptar y desencriptar contraseñas
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = new Server(server);

app.use(session({
    secret: process.env.SECRET,  // Clave segura de la variable de entorno
    resave: false,               // No guardar la sesión si no hubo cambios
    saveUninitialized: false,    // No guardar sesiones vacías
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 día (en milisegundos)
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

        //Resolución si no existe el usuario
        if (!resultado) {
            return res.status(401).json({ error: "Usuario inexistente" });
        }

        //Ponemos como condicional para hacer la comprobación que las contraseñas coincidan
        if (await bcrypt.compare(password, resultado.contraseña)) {

            //Comprobamos la lista para ver si está conectado
            if (listaUsuarios[resultado.nombre]) {
                return res.status(401).json({ error: "Este usuario ya está conectado" });
            }

            // Usuario encontrado en la base de datos y no conectado.
            res.cookie('nombreUsuario', resultado.nombre, {
                secure: true,   // Cambia a true si usas HTTPS
                sameSite: 'Strict', // Protección CSRF
            });

            req.session.usuario = resultado.nombre;
            res.status(200).json({ message: "Inicio de sesión exitoso", usuario: resultado });

            //Aquí redirigimos a la página del chat, además hay que logearlo al server.io

        } else {
            const existe = await usuario.findOne({ $or: [{ correo: user }, { nombre: user }] });
            if (existe) {
                res.status(401).json({ error: "Contraseña incorrecta" });
                //Aquí colgamos un mensaje indicando el error
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
        next(); // El usuario está autenticado, continúa con la siguiente función
    } else {
        res.status(401).send('Acceso denegado. Por favor inicia sesión.');
    }
}

let listaUsuarios = {}; // Formato: { "Juan": { id: "socket123", publicKey: {...} } }

io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado:', socket.id);

    // 1. Asignar usuario guardando su clave pública
    socket.on('asignarUsuario', (data) => {
        // data viene del frontend como: { nombre: "Juan", publicKey: {...} }
        listaUsuarios[data.nombre] = {
            id: socket.id,
            publicKey: data.publicKey
        };
        console.log(`Usuario asignado: ${data.nombre} (Clave recibida)`);
        
        // Enviamos a todos SOLO un array con los nombres (Object.keys)
        io.emit('actualizar lista', Object.keys(listaUsuarios));
    });

    // 2. NUEVO: Evento para servir la clave pública de un usuario a otro
    socket.on('pedirClave', (nombreDestinatario, callback) => {
        const usuario = listaUsuarios[nombreDestinatario];
        
        if (usuario && usuario.publicKey) {
            // El usuario existe y tiene clave, la devolvemos al frontend que la pidió
            callback({ success: true, publicKey: usuario.publicKey });
        } else {
            // El usuario no existe o no generó clave
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
            console.log(`Mensaje cifrado transferido de ${msg.emisor} a ${msg.receptor}. Mensaje encriptado: ${msg.mensaje}`);
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
        
        // Enviamos la lista actualizada (array de nombres)
        io.emit('actualizar lista', Object.keys(listaUsuarios));
    });
});