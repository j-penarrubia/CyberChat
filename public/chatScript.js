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

// ========================
// USUARIO ACTUAL (cookie)
// ========================
const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=');
    acc[key] = decodeURIComponent(value || '');
    return acc;
}, {});

const nombreUsuario = cookies['nombreUsuario'] || '';

if (nombreUsuario) {
    socket.emit('asignarUsuario', nombreUsuario);
}

// ========================
// UTILIDADES
// ========================

/** Convierte un nombre a una cadena segura para usar como clase CSS */
function toCSS(nombre) {
    return nombre
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Crea un elemento <li> de mensaje completo.
 * @param {string} emisor   - Nombre real del emisor
 * @param {string} texto    - Contenido del mensaje
 * @param {'enviado'|'recibido'} tipo
 * @param {string|null} etiqueta - Texto que muestra el encabezado (por defecto: emisor)
 */
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

/** Crea la ventana de chat privado si aún no existe */
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

/** Hace scroll al fondo de una ventana por su clase CSS segura */
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
    for (const nombre in lista) {
        if (nombre === nombreUsuario) continue;

        const li = document.createElement('li');
        li.textContent = nombre;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            cambiarChat(nombre);
        });
        listaUsuarios.appendChild(li);
    }
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
    socket.emit('mensajePublico', { emisor: nombreUsuario, mensaje: input.value });
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

    // Marcar usuario activo y quitar icono de notificación
    Array.from(listaUsuarios.children).forEach(li => {
        const esActual = li.textContent.trim() === nombre;
        li.classList.toggle('actual', esActual);
        if (esActual) li.querySelector('i')?.remove();
    });

    // Ocultar todas las ventanas
    document.querySelectorAll('.ventana-chat').forEach(v => {
        v.classList.remove('activo');
        v.classList.add('oculto');
    });

    // Crear ventana si no existe y activarla
    asegurarVentanaPrivada(css);
    const ventana = document.querySelector(`.ventana-chat.${css}`);
    ventana.classList.remove('oculto');
    ventana.classList.add('activo');

    form.removeEventListener('submit', enviarMensajePublico);
    form.addEventListener('submit', enviarMensajePrivado);
}

socket.on('mensajePrivado', (msg) => {
    const emisorCSS = toCSS(msg.emisor);

    asegurarVentanaPrivada(emisorCSS);

    const chatPrivado = document.querySelector(`.chat_privado.${emisorCSS}`);
    chatPrivado.appendChild(crearMensaje(msg.emisor, msg.mensaje, 'recibido'));

    // Icono de notificación si el chat no está activo
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

    // Scroll solo si la ventana del emisor está activa
    if (document.querySelector(`.ventana-chat.${emisorCSS}.activo`)) {
        scrollToBottom(emisorCSS);
    }
});

function enviarMensajePrivado(event) {
    event.preventDefault();
    if (!input.value.trim()) return;

    const destinatarioCSS = toCSS(destinatario);
    socket.emit('mensajePrivado', { emisor: nombreUsuario, mensaje: input.value, receptor: destinatario });

    const chatPrivado = document.querySelector(`.chat_privado.${destinatarioCSS}`);
    chatPrivado.appendChild(crearMensaje(nombreUsuario, input.value, 'enviado', 'Tú'));

    input.value = '';
    scrollToBottom(destinatarioCSS);
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