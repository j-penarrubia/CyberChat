import {bufferToBase64, derivarKEK} from './crypto-utils.js';

document.getElementById("formularioRegistro").addEventListener("submit", async function (event) {
    event.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const correo = document.getElementById("correo").value;
    const contraseña = document.getElementById("password").value;

    if (!validarCorreo(correo)) {
        alert("Por favor, ingresa un correo electrónico válido.");
        return;
    }

    await registrarUsuario(nombre, correo, contraseña);
});

function validarCorreo(correo) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(correo);
}

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById('mostrar').addEventListener('change', function () {
        var passwordInput = document.getElementById('password');
        passwordInput.type = this.checked ? 'text' : 'password';
        passwordInput.focus();
    });
});

async function registrarUsuario(nombre, correo, contraseña) {
    try {
        let modal = document.getElementById('loadingModal');
        modal.style.display = 'flex';

        // 1. Generacion de par de claves RSA
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt", "wrapKey", "unwrapKey"] 
        );

        // 2. Exportar la clave pública a formato JWK (JSON) y luego a string
        const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
        const publicKeyString = JSON.stringify(publicKeyJwk);

        // 3. Generar parámetros aleatorios para el cifrado simétrico
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // 4. Derivar la KEK
        const kek = await derivarKEK(contraseña, salt);

        // 5. Envolver (cifrar) la clave privada RSA usando la KEK y AES-GCM
        const wrappedPrivateKey = await window.crypto.subtle.wrapKey(
            "jwk",             
            keyPair.privateKey, 
            kek,               
            { name: "AES-GCM", iv: iv }
        );

        const encryptedPrivateKeyB64 = bufferToBase64(wrappedPrivateKey);
        const ivB64 = bufferToBase64(iv);
        const saltB64 = bufferToBase64(salt);

        // 6. Enviar todo al servidor
        const response = await fetch("/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                nombre, 
                correo, 
                contraseña,
                publicKey: publicKeyString,
                privateKey: encryptedPrivateKeyB64,
                cryptoIv: ivB64,
                cryptoSalt: saltB64
            }),
        });

        if (response.ok) {
            setTimeout(() => { window.location.href = '/'; }, 1500);
        } else {
            const error = await response.json();
            document.querySelector('p').innerText = error.error || "Error en el registro";
            modal.style.display = 'none';
        }
    } catch (error) {
        console.error("Error criptográfico o de red:", error);
        document.getElementById('loadingModal').style.display = 'none';
    }
}

