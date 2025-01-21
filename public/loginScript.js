document.getElementById("formularioLogin").addEventListener("submit", async function (event) {
    event.preventDefault();

    const usuario = document.getElementById("user").value;
    const contraseña = document.getElementById("password").value;

    await logearUsuario(usuario, contraseña);
});

async function logearUsuario(user, password) {
    try {
        console.log(user, password);
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ user, password }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data.message);
            window.location.href = "/chat.html";
            //Añadir un mensaje en el html aquí para indicar el resultado de la operación

            //Además, mostrar un cuadro que indique la redirección al chat
        } else {
            const error = await response.json();
            console.error("Error:", error.error);
            //Añadir un mensaje en el html aquí para indicar el resultado de la operación

        }
    } catch (error) {
        console.error("Houston, tenemos un problema:", error);
    }
}