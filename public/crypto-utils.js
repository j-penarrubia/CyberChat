export function normalizarArrayBuffer(data) {
    if (data instanceof ArrayBuffer) return data;
    if (ArrayBuffer.isView(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    throw new Error("Tipo de dato no soportado para conversión");
}

export function arrayBufferToBase64(buffer) {
    const ab = normalizarArrayBuffer(buffer);
    let binary = '';
    const bytes = new Uint8Array(ab);

    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

export function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function derivarKEK(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["wrapKey", "unwrapKey"]
    );
}

export async function pedirClaveAlServidor(socket, receptor) {
    return new Promise((resolve, reject) => {
        socket.emit('pedirClave', receptor, async (respuesta) => {
            if (!respuesta.success) {
                reject(respuesta.error || "No se pudo obtener la clave pública");
                return;
            }

            try {
                let publicKeyObj = respuesta.publicKey;
                if (typeof publicKeyObj === 'string') {
                    publicKeyObj = JSON.parse(publicKeyObj);
                }
                const cryptoKey = await window.crypto.subtle.importKey(
                    "jwk",
                    publicKeyObj,
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    false,
                    ["encrypt","wrapKey"]
                );

                resolve(cryptoKey);
            } catch (e) {
                reject("Error importando la clave pública del destinatario: " + e.message);
            }
        });
    });
}

export async function cifrarMensajePrivado(textoPlano, publicKeyReceptor) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const dataCodificada = new TextEncoder().encode(textoPlano);

    const mensajeCifradoBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        dataCodificada
    );

    const wrappedKeyBuffer = await window.crypto.subtle.wrapKey(
        "raw",
        aesKey,
        publicKeyReceptor,
        { name: "RSA-OAEP" }
    );

    return {
        mensaje: arrayBufferToBase64(mensajeCifradoBuffer),
        wrappedKey: arrayBufferToBase64(wrappedKeyBuffer),
        iv: arrayBufferToBase64(iv)
    };
}

export async function descifrarMensajePrivado(privateKey, msg) {
    if (!privateKey) {
        throw new Error("La clave privada no está cargada");
    }

    const wrappedKeyBuffer = base64ToArrayBuffer(msg.wrappedKey);
    const ivBuffer = base64ToArrayBuffer(msg.iv);
    const mensajeCifradoBuffer = base64ToArrayBuffer(msg.mensaje);

    const aesKey = await window.crypto.subtle.unwrapKey(
        "raw",
        wrappedKeyBuffer,
        privateKey,
        { name: "RSA-OAEP" },
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt", "unwrapKey"]
    );

    const bufferDescifrado = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
        aesKey,
        mensajeCifradoBuffer
    );

    return new TextDecoder().decode(bufferDescifrado);
}