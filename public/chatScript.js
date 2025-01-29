const socket = io();
var form = document.getElementById('form');
const input = document.getElementById('input');
const chatPublico = document.getElementById('chat_publico');
const listaUsuarios = document.getElementById('usuariosConectados');
const ventanaPrincipal = document.getElementById('contenido-principal');
const chatInput = document.getElementById('chat-input');
var encabezado = document.getElementById("encabezado");
var destinatario;

const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=');
    acc[key] = value;
    return acc;
}, {});

console.log(cookies);

const nombreUsuario = cookies['nombreUsuario'];

if (nombreUsuario) {
    console.log('Nombre de usuario:', nombreUsuario);
    // Puedes usar el nombre de usuario para conectar el socket, por ejemplo:
    socket.emit('asignarUsuario', nombreUsuario);
}

socket.on('actualizar lista', (lista) => {
    listaUsuarios.innerHTML = "";
    for (let nombre in lista) {
        if (nombre == nombreUsuario) { } else {
            const li = document.createElement('li');
            li.textContent = nombre;
            li.addEventListener('click', (event) => {
                event.preventDefault();
                cambiarChat(nombre);
            })
            listaUsuarios.appendChild(li);
        }
    };
});

function cambiarChat(nombre) {
    document.querySelectorAll('.ventana-chat').forEach(ventana => {
        ventana.classList.remove('activo');
    });

    document.querySelectorAll('.ventana-chat').forEach(ventana => {
        ventana.classList.add('oculto');
    });
    console.log(nombre);

    if (!document.querySelector(`.${nombre}`)) {
        const nuevaVentana = document.createElement('div');
        nuevaVentana.className = 'ventana-chat';
        nuevaVentana.classList.add(`${nombre}`);
        nuevaVentana.innerHTML =
            `<div id="mensajes-chat">
                <ul class="chat_privado ${nombre}"></ul>
            </div>`;
        nuevaVentana.classList.add('activo');
        ventanaPrincipal.insertBefore(nuevaVentana, chatInput);
    } else {
        document.querySelector(`.${nombre}`).classList.remove('oculto');
        document.querySelector(`.${nombre}`).classList.add('activo');
    }

    var botonEnviar = document.getElementById("form");
    botonEnviar.removeEventListener('submit', enviarMensajePublico);
    botonEnviar.addEventListener('submit', enviarMensajePrivado);

    encabezado.innerText = `Chat privado con ${nombre}`;
    destinatario = nombre;


}

// Escuchar mensajes públicos del servidor
socket.on('mensajePublico', (msg) => {
    const item = document.createElement('li');
    item.classList.add("mensaje");
    if (msg.emisor == nombreUsuario) {
        console.log("Este mensaje lo has enviado tu");
        item.classList.add("enviado");
    } else {
        item.classList.add("recibido");
    }

    const avatar = document.createElement('div');
    avatar.classList.add("avatar");
    avatar.textContent = msg.emisor.charAt(0).toUpperCase();
    item.appendChild(avatar);

    const mensaje = document.createElement('div');
    mensaje.classList.add("contenido-mensaje");

    const encabezado = document.createElement('div');
    encabezado.classList.add("encabezado-mensaje");

    const usuario = document.createElement('span');
    usuario.classList.add("usuario-mensaje");
    usuario.textContent = msg.emisor;
    encabezado.appendChild(usuario);
    mensaje.appendChild(encabezado);

    const texto = document.createElement("div");
    texto.classList.add("texto-mensaje");
    texto.innerText = msg.mensaje;
    mensaje.appendChild(texto);

    item.appendChild(mensaje)

    chatPublico.appendChild(item);
    scrollToBottom("publico");
});

// Escuchar mensajes privados del servidor
socket.on('mensajePrivado', (msg) => {

    //Primero se crea el mensaje
    const item = document.createElement('li');
    item.classList.add("mensaje");
    item.classList.add("recibido");

    const avatar = document.createElement('div');
    avatar.classList.add("avatar");
    avatar.textContent = msg.emisor.charAt(0).toUpperCase();
    item.appendChild(avatar);

    const mensaje = document.createElement('div');
    mensaje.classList.add("contenido-mensaje");

    const encabezado = document.createElement('div');
    encabezado.classList.add("encabezado-mensaje");

    const usuario = document.createElement('span');
    usuario.classList.add("usuario-mensaje");
    usuario.textContent = msg.emisor;
    encabezado.appendChild(usuario);
    mensaje.appendChild(encabezado);

    const texto = document.createElement("div");
    texto.classList.add("texto-mensaje");
    texto.innerText = msg.mensaje;
    mensaje.appendChild(texto);

    item.appendChild(mensaje);

    //Después comprobamos si tenemos ya creada la parte del chat que debería almacenar los mensajes, pero la creamos sin clase activo
    if (!document.querySelector(`.chat_privado.${msg.emisor}`)) {
        const nuevaVentana = document.createElement('div');
        nuevaVentana.className = 'ventana-chat';
        nuevaVentana.classList.add("oculto");
        nuevaVentana.classList.add(`${msg.emisor}`);
        nuevaVentana.innerHTML =
            `<div id="mensajes-chat">
                    <ul class="chat_privado ${msg.emisor}"></ul>
            </div>`;
        ventanaPrincipal.insertBefore(nuevaVentana, chatInput);
    }
    var chatPrivado = document.querySelector(`.chat_privado.${msg.emisor}`);

    chatPrivado.appendChild(item);
    if (document.querySelector(`.ventana-chat.${msg.emisor}.activo`)) {
        const ventana = (`${msg.emisor}.activo`);
        console.log(ventana);
        scrollToBottom(ventana);
    }

});

function scrollToBottom(ventana) {
    const chatWindow = document.querySelector(`.ventana-chat.${ventana}`);
    console.log(ventana);

    chatWindow.scrollTo({
        top: chatWindow.scrollHeight,
        behavior: 'smooth'
    });
}

//Enviar mensaje público
function enviarMensajePublico(event) {
    event.preventDefault();
    if (input.value) {
        socket.emit('mensajePublico', { emisor: nombreUsuario, mensaje: input.value });
        input.value = '';
    }
}

//Enviar mensaje privado
function enviarMensajePrivado(event) {
    event.preventDefault();
    if (input.value) {
        socket.emit('mensajePrivado', { emisor: nombreUsuario, mensaje: input.value, receptor: destinatario });

        //Pintar el mensaje en nuestro chat
        const item = document.createElement('li');
        item.classList.add("mensaje");
        item.classList.add("enviado");
        const avatar = document.createElement('div');
        avatar.classList.add("avatar");
        avatar.textContent = nombreUsuario.charAt(0).toUpperCase();
        item.appendChild(avatar);

        const mensaje = document.createElement('div');
        mensaje.classList.add("contenido-mensaje");

        const encabezado = document.createElement('div');
        encabezado.classList.add("encabezado-mensaje");

        const usuario = document.createElement('span');
        usuario.classList.add("usuario-mensaje");
        usuario.textContent = "Tú";
        encabezado.appendChild(usuario);
        mensaje.appendChild(encabezado);

        const texto = document.createElement("div");
        texto.classList.add("texto-mensaje");
        texto.innerText = input.value;
        mensaje.appendChild(texto);

        item.appendChild(mensaje)

        var chatPrivado = document.querySelector(`.chat_privado.${destinatario}`);
        chatPrivado.appendChild(item);

        input.value = '';
        scrollToBottom(`${destinatario}`);
    }
}

form.addEventListener('submit', enviarMensajePublico);
