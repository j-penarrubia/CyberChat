// ========================
// CONEXIÓN Y ELEMENTOS DOM
// ========================
const socket = io();

const form            = document.getElementById('form');
const input           = document.getElementById('input');
const chatPublico     = document.getElementById('chat_publico');
const listaUsuarios   = document.getElementById('usuariosConectados');
const ventanaPrincipal = document.getElementById('contenido-principal');
const chatInput       = document.getElementById('chat-input');
const encabezado      = document.getElementById('encabezado');
const botonChatPublico = document.getElementById('volverChatPublico');

let destinatario = null;

// Variables globales para la criptografía
let keys;
let publicKey;

// ========================
// USUARIO ACTUAL Y CRIPTOGRAFÍA
// ========================
const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=');
    acc[key] = decodeURIComponent(value || '');
    return acc;
}, {});

const nombreUsuario = cookies['nombreUsuario'] || '';

async function inicializarCriptografia() {
    try {
        // Generar par de claves RSA-OAEP
        keys = await window.crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt"]
        );
        
        // Exportar la clave pública a JWK para enviarla al servidor
        publicKey = await window.crypto.subtle.exportKey("jwk", keys.publicKey);
        
        // Asignar usuario enviando también la clave pública
        socket.emit('asignarUsuario', { 
            nombre: nombreUsuario, 
            publicKey: publicKey 
        });
    } catch (e) {
        console.error("Error al generar las claves criptográficas:", e);
        alert("Tu navegador no soporta cifrado de extremo a extremo.");
    }
}

if (nombreUsuario) {
    inicializarCriptografia();
}

// ========================
// UTILIDADES E2EE
// ========================

// Convertir ArrayBuffer a Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Convertir Base64 a ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// Pedir la clave pública de un usuario al servidor
async function pedirClaveAlServidor(receptor) {
    return new Promise((resolve, reject) => {
        socket.emit('pedirClave', receptor, async (respuesta) => {
            if (respuesta.success) {
                try {
                    const cryptoKey = await window.crypto.subtle.importKey(
                        "jwk",
                        respuesta.publicKey,
                        { name: "RSA-OAEP", hash: "SHA-256" },
                        false, 
                        ["encrypt"] 
                    );
                    resolve(cryptoKey);
                } catch (e) {
                    reject("Error importando la clave del destinatario: " + e);
                }
            } else {
                reject(respuesta.error);
            }
        });
    });
}

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
document.addEventListener('DOMContentLoaded', () => {
    form.addEventListener('submit', enviarMensajePublico);
    botonChatPublico.addEventListener('click', volverChatPublico);

    document.getElementById('nombre-usuario').innerText =
        nombreUsuario.charAt(0).toUpperCase() + nombreUsuario.slice(1);

    const iconoMenu  = document.querySelector('.icono-tres-puntos');
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
// CHAT PÚBLICO (No cifrado)
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
    socket.emit('mensajePublico', { emisor: nombreUsuario, mensaje: input.value });
    input.value = '';
}

// ========================
// CHAT PRIVADO (Cifrado E2EE)
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
        // 1. Convertir y desencriptar
        const bufferCifrado = base64ToArrayBuffer(msg.mensaje);
        const bufferDescifrado = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            keys.privateKey,
            bufferCifrado
        );
        
        const decoder = new TextDecoder();
        textoAMostrar = decoder.decode(bufferDescifrado);
    } catch (error) {
        console.error("No se pudo descifrar el mensaje:", error);
        textoAMostrar = "⚠️ [Mensaje cifrado ilegible]";
    }

    // 2. Pintar mensaje en pantalla
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

// Encriptar y enviar mensaje
async function enviarMensajePrivado(event) {
    event.preventDefault();
    if (!input.value.trim()) return;

    const textoPlano = input.value;
    const destinatarioCSS = toCSS(destinatario);
    
    input.value = ''; 

    try {
        // 1. Obtener clave del receptor
        const publicKeyReceptor = await pedirClaveAlServidor(destinatario);
        
        // 2. Cifrar
        const encoder = new TextEncoder();
        const dataCodificada = encoder.encode(textoPlano);
        const mensajeCifradoBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKeyReceptor, 
            dataCodificada
        );
        
        // 3. Enviar (pasando a base64 para que JSON.stringify no lo rompa)
        socket.emit('mensajePrivado', { 
            emisor: nombreUsuario, 
            mensaje: arrayBufferToBase64(mensajeCifradoBuffer), 
            receptor: destinatario 
        });

        // 4. Pintar tu propio mensaje en tu pantalla (tú lo ves en claro, no cifrado)
        const chatPrivado = document.querySelector(`.chat_privado.${destinatarioCSS}`);
        chatPrivado.appendChild(crearMensaje(nombreUsuario, textoPlano, 'enviado', 'Tú'));
        scrollToBottom(destinatarioCSS);

    } catch (error) {
        console.error("No se pudo enviar el mensaje cifrado:", error);
        alert(`No se pudo cifrar el mensaje para ${destinatario}. El usuario no existe o no tiene clave asignada.`);
    }
}

// ========================
// CERRAR SESIÓN
// ========================
async function cerrarSesion(event) {
    event.preventDefault();
    const modal = document.getElementById('loadingModal');
    try {
        const response = await fetch('/logout', { method: 'POST', credentials: 'include' });
        modal.style.display = 'flex';

        if (!response.ok) throw new Error('Error al cerrar sesión');

        setTimeout(() => { window.location.href = '/'; }, 3000);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        modal.style.display = 'none';
    }
}