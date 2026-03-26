import {pedirClaveAlServidor, cifrarMensajePrivado, descifrarMensajePrivado} from './crypto-utils.js';

// ========================
// CONEXIÓN Y ELEMENTOS DOM
// ========================
const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const chatPublico = document.getElementById('chat_publico');
const listaUsuarios = document.getElementById('usuariosConectados');
const ventanaPrincipal = document.getElementById('contenido-principal');
const chatInput = document.getElementById('chat-input');
const encabezado = document.getElementById('encabezado');
const botonChatPublico = document.getElementById('volverChatPublico');

let destinatario = null;
let privateKey = null;
let cryptoReady = false;


// ========================
// USUARIO ACTUAL
// ========================
const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=');
    acc[key] = decodeURIComponent(value || '');
    return acc;
}, {});

const nombreUsuario = cookies['nombreUsuario'] || '';


// ========================
// INDEXEDDB
// ========================
function abrirDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("CyberChatSeguridad", 1);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("claves")) {
                db.createObjectStore("claves");
            }
        };

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

async function obtenerClaveDeIndexedDB(nombreClave) {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["claves"], "readonly");
        const store = transaction.objectStore("claves");
        const request = store.get(nombreClave);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function eliminarClaveDeIndexedDB(nombreClave) {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["claves"], "readwrite");
        const store = transaction.objectStore("claves");
        const request = store.delete(nombreClave);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}


// ========================
// SESIÓN CRIPTOGRÁFICA
// ========================
async function inicializarSesionCriptografica() {
    try {
        if (!nombreUsuario) {
            window.location.href = '/';
            return;
        }

        privateKey = await obtenerClaveDeIndexedDB("miClavePrivada");

        if (!privateKey) {
            throw new Error("No se encontró la clave privada en IndexedDB");
        }

        cryptoReady = true;
        registrarUsuarioEnSocket();
    } catch (e) {
        console.error("Error cargando la clave privada:", e);
        alert("No se pudo cargar tu identidad criptográfica. Inicia sesión de nuevo.");
        window.location.href = '/';
    }
}

function registrarUsuarioEnSocket() {
    if (!socket.connected || !nombreUsuario) return;

    socket.emit('asignarUsuario', {
        nombre: nombreUsuario
    });
}

socket.on('connect', () => {
    if (cryptoReady) {
        registrarUsuarioEnSocket();
    }
});

// ========================
// UTILIDADES UI
// ========================
function toCSS(nombre) {
    return nombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

function crearMensaje(emisor, texto, tipo, etiqueta = null) {
    const item = document.createElement('li');
    item.classList.add('mensaje', tipo);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = emisor.charAt(0).toUpperCase();

    const contenido = document.createElement('div');
    contenido.classList.add('contenido-mensaje');

    const cabecera = document.createElement('div');
    cabecera.classList.add('encabezado-mensaje');

    const spanNombre = document.createElement('span');
    spanNombre.classList.add('usuario-mensaje');
    spanNombre.textContent = etiqueta ?? emisor;

    const spanTexto = document.createElement('div');
    spanTexto.classList.add('texto-mensaje');
    spanTexto.innerText = texto;

    cabecera.appendChild(spanNombre);
    contenido.appendChild(cabecera);
    contenido.appendChild(spanTexto);
    item.appendChild(avatar);
    item.appendChild(contenido);

    return item;
}

function asegurarVentanaPrivada(css) {
    if (document.querySelector(`.ventana-chat.${css}`)) return;

    const ventana = document.createElement('div');
    ventana.classList.add('ventana-chat', 'oculto', css);
    ventana.innerHTML = `
        <div id="mensajes-chat">
            <ul class="chat_privado ${css}"></ul>
        </div>`;

    ventanaPrincipal.insertBefore(ventana, chatInput);
}

function scrollToBottom(css) {
    const ventana = document.querySelector(`.ventana-chat.${css}`);
    if (ventana) {
        ventana.scrollTo({ top: ventana.scrollHeight, behavior: 'smooth' });
    }
}


// ========================
// INICIALIZACIÓN DOM
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    form.addEventListener('submit', enviarMensajePublico);
    botonChatPublico.addEventListener('click', volverChatPublico);

    document.getElementById('nombre-usuario').innerText =
        nombreUsuario.charAt(0).toUpperCase() + nombreUsuario.slice(1);

    const iconoMenu = document.querySelector('.icono-tres-puntos');
    const menuContent = document.querySelector('.menu-content');

    iconoMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
        iconoMenu.classList.toggle('active');
    });

    window.addEventListener('click', () => {
        iconoMenu.classList.remove('active');
        document.querySelectorAll('.menu-content').forEach(m => m.style.display = 'none');
    });

    await inicializarSesionCriptografica();
});


// ========================
// LISTA DE USUARIOS
// ========================
socket.on('actualizar lista', (lista) => {
    listaUsuarios.innerHTML = '';

    lista.forEach(nombre => {
        if (nombre === nombreUsuario) return;

        const li = document.createElement('li');
        li.textContent = nombre;

        li.addEventListener('click', (e) => {
            e.preventDefault();
            cambiarChat(nombre);
        });

        listaUsuarios.appendChild(li);
    });
});


// ========================
// CHAT PÚBLICO
// ========================
function volverChatPublico() {
    Array.from(listaUsuarios.children).forEach(u => u.classList.remove('actual'));
    botonChatPublico.classList.add('actual');
    botonChatPublico.innerText = 'Chat Público';
    encabezado.innerText = 'Chat Público';

    document.querySelectorAll('.ventana-chat').forEach(v => {
        v.classList.remove('activo');
        v.classList.add('oculto');
    });

    const ventanaPublica = document.querySelector('.ventana-chat.publico');
    ventanaPublica.classList.remove('oculto');
    ventanaPublica.classList.add('activo');

    form.removeEventListener('submit', enviarMensajePrivado);
    form.addEventListener('submit', enviarMensajePublico);
}

socket.on('mensajePublico', (msg) => {
    const tipo = msg.emisor === nombreUsuario ? 'enviado' : 'recibido';
    chatPublico.appendChild(crearMensaje(msg.emisor, msg.mensaje, tipo));
    scrollToBottom('publico');
});

function enviarMensajePublico(event) {
    event.preventDefault();

    if (!input.value.trim()) return;

    socket.emit('mensajePublico', {
        emisor: nombreUsuario,
        mensaje: input.value
    });

    input.value = '';
}


// ========================
// CHAT PRIVADO
// ========================
function cambiarChat(nombre) {
    const css = toCSS(nombre);

    botonChatPublico.classList.remove('actual');
    botonChatPublico.innerText = 'Volver al Chat Público';
    encabezado.innerText = `Chat privado con ${nombre}`;
    destinatario = nombre;

    Array.from(listaUsuarios.children).forEach(li => {
        const esActual = li.textContent.trim() === nombre;
        li.classList.toggle('actual', esActual);
        if (esActual) li.querySelector('i')?.remove();
    });

    document.querySelectorAll('.ventana-chat').forEach(v => {
        v.classList.remove('activo');
        v.classList.add('oculto');
    });

    asegurarVentanaPrivada(css);
    const ventana = document.querySelector(`.ventana-chat.${css}`);
    ventana.classList.remove('oculto');
    ventana.classList.add('activo');

    form.removeEventListener('submit', enviarMensajePublico);
    form.addEventListener('submit', enviarMensajePrivado);
}

socket.on('mensajePrivado', async (msg) => {
    const emisorCSS = toCSS(msg.emisor);
    asegurarVentanaPrivada(emisorCSS);

    let textoAMostrar = "";

    try {
        textoAMostrar = await descifrarMensajePrivado(privateKey, msg);
    } catch (error) {
        console.error("No se pudo descifrar el mensaje:", error);
        textoAMostrar = "⚠️ [Mensaje cifrado ilegible]";
    }

    const chatPrivado = document.querySelector(`.chat_privado.${emisorCSS}`);
    chatPrivado.appendChild(crearMensaje(msg.emisor, textoAMostrar, 'recibido'));

    listaUsuarios.querySelectorAll('li').forEach(li => {
        if (
            li.textContent.trim() === msg.emisor &&
            !li.classList.contains('actual') &&
            !li.querySelector('i')
        ) {
            const icono = document.createElement('i');
            icono.classList.add('far', 'fa-comment');
            li.appendChild(icono);
        }
    });

    if (document.querySelector(`.ventana-chat.${emisorCSS}.activo`)) {
        scrollToBottom(emisorCSS);
    }
});

async function enviarMensajePrivado(event) {
    event.preventDefault();

    if (!input.value.trim()) return;
    if (!destinatario) return;
    if (!cryptoReady) {
        alert("Tu clave privada todavía no está cargada.");
        return;
    }

    const textoPlano = input.value;
    const destinatarioCSS = toCSS(destinatario);

    input.value = '';

    try {
        const publicKeyReceptor = await pedirClaveAlServidor(socket, destinatario);

        const payloadCifrado = await cifrarMensajePrivado(textoPlano, publicKeyReceptor);

        socket.emit('mensajePrivado', {
            emisor: nombreUsuario,
            receptor: destinatario,
            mensaje: payloadCifrado.mensaje,
            wrappedKey: payloadCifrado.wrappedKey,
            iv: payloadCifrado.iv
        });

        const chatPrivado = document.querySelector(`.chat_privado.${destinatarioCSS}`);
        chatPrivado.appendChild(crearMensaje(nombreUsuario, textoPlano, 'enviado', 'Tú'));
        scrollToBottom(destinatarioCSS);

    } catch (error) {
        console.error("No se pudo enviar el mensaje cifrado:", error);
        alert(`No se pudo cifrar el mensaje para ${destinatario}.`);
    }
}


// ========================
// CERRAR SESIÓN
// ========================
async function cerrarSesion(event) {
    event.preventDefault();
    const modal = document.getElementById('loadingModal');

    try {
        modal.style.display = 'flex';

        try {
            await eliminarClaveDeIndexedDB("miClavePrivada");
        } catch (e) {
            console.warn("No se pudo borrar la clave local:", e);
        }

        const response = await fetch('/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error al cerrar sesión');
        }

        setTimeout(() => {
            window.location.href = '/';
        }, 1500);

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        modal.style.display = 'none';
    }
}