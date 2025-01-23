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
        const li = document.createElement('li');
        li.textContent = nombre;
        listaUsuarios.appendChild(li);
    };
});

// Escuchar mensajes del servidor
socket.on('mensajePublico', (msg) => {
    const item = document.createElement('li');
    if (msg.emisor == nombreUsuario) {
        console.log("ESte mensaje lo has enviado tu");
        //Aquí le daremos clase al elemento para diferenciar nuestro mensajes de los de los demás usuarios,
        //Utilizaremos item.classAdd o alguna movida así
    } else {
        //En caso de no ser nuestro mensaje, le daremos otra clase y así los diferenciaremos
    }
    item.textContent = msg.mensaje;
    chatPublico.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

//Enviar mensaje público
form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value) {
        socket.emit('mensajePublico', { emisor: nombreUsuario, mensaje: input.value });
        input.value = '';
    }
});
