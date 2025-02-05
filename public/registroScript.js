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
        const response = await fetch("/registro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ nombre, correo, contraseña }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data.message);
            //Añadir un mensaje en el html aquí para indicar el resultado de la operación
            let modal = document.getElementById('loadingModal');
            modal.style.display = 'flex';
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } else {
            const error = await response.json();
            console.error("Error:", error.error);
            var fallo = document.querySelector('p');
            fallo.innerText = error.error;
            //Añadir un mensaje en el html aquí para indicar el resultado de la operación
        }
    } catch (error) {
        console.error("Error de red:", error);
    } finally {
        let modal = document.getElementById('loadingModal');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 3000);
    }
}
