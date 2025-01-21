const socket = io();

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
