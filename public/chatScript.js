const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const chatPublico = document.getElementById('chat_publico');
const listaUsuarios = document.getElementById('usuariosConectados');

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
            listaUsuarios.appendChild(li);
        }
    };
});

// Escuchar mensajes del servidor
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
    scrollToBottom();
});

function scrollToBottom() {
    const chatWindow = document.querySelector('.ventana-chat');

    chatWindow.scrollTo({
        top: chatWindow.scrollHeight,
        behavior: 'smooth'
    });
}

//Enviar mensaje público
form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value) {
        socket.emit('mensajePublico', { emisor: nombreUsuario, mensaje: input.value });
        input.value = '';
    }
});
