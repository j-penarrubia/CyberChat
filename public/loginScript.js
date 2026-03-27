import { base64ToBuffer, derivarKEK } from './crypto-utils.js';

document.getElementById("formularioLogin").addEventListener("submit", async function (event) {
    event.preventDefault();

    const usuario = document.getElementById("user").value;
    const contraseña = document.getElementById("password").value;
    const pErrorAnterior = document.getElementById('pError');
    if (pErrorAnterior) {
        pErrorAnterior.remove();
    }

    await logearUsuario(usuario, contraseña);
});

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById('mostrar').addEventListener('change', function () {
        var passwordInput = document.getElementById('password');
        passwordInput.type = this.checked ? 'text' : 'password';
        passwordInput.focus();
    });
});

async function logearUsuario(user, password) {
    try {
        let modal = document.getElementById('loadingModal');
        modal.style.display = 'flex';

        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user, password }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data.usuario);
            
            // --- CRIPTOGRAFÍA ---
            try {
                // 1. Convertir Base64 a Buffers
                const ivBuffer = base64ToBuffer(data.usuario.cryptoIv);
                const saltBuffer = base64ToBuffer(data.usuario.cryptoSalt);
                const encryptedKeyBuffer = base64ToBuffer(data.usuario.privateKey);

                // 2. Derivar la misma KEK
                const kek = await derivarKEK(password, saltBuffer);

                // 3. Desenvolver (descifrar) la clave privada
                const privateKey = await window.crypto.subtle.unwrapKey(
                    "jwk",
                    encryptedKeyBuffer,
                    kek,
                    { name: "AES-GCM", iv: ivBuffer },
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    false,
                    ["decrypt", "unwrapKey"]
                );

                // 4. Guardar de forma segura en IndexedDB
                await guardarClaveEnIndexedDB("PK", privateKey);
                
                // Redirigir al chat
                window.location.href = '/chat';
            } catch (cryptoError) {
                console.error("Error al descifrar la clave. ¿Han manipulado los datos?:", cryptoError);
                modal.style.display = 'none';
                mostrarError("Error crítico de seguridad al cargar tus claves.");
            }

        } else {
            const error = await response.json();
            modal.style.display = 'none';
            mostrarError(error.error);
        }
    } catch (error) {
        console.error("Error de red:", error);
    }
}

// Promise para guardar en IndexedDB
function guardarClaveEnIndexedDB(nombreClave, claveObj) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("CyberChatSeguridad", 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("claves")) {
                db.createObjectStore("claves");
            }
        };

        request.onsuccess = function(event) {
            const db = event.target.result;
            const transaction = db.transaction(["claves"], "readwrite");
            const store = transaction.objectStore("claves");
            const putRequest = store.put(claveObj, nombreClave);

            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };

        request.onerror = () => reject(request.error);
    });
}

function mostrarError(mensaje) {
    let pError = document.getElementById('pError');
    if (!pError) {
        pError = document.createElement('p');
        pError.id = 'pError';
        pError.className = 'mensaje-error';
        document.getElementById('formularioLogin').appendChild(pError);
    }
    
    // Mostrar el mensaje
    pError.textContent = mensaje;
    pError.style.display = 'block';
}