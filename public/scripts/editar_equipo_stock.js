
        document.addEventListener('DOMContentLoaded', () => {
            // Editar
            document.querySelectorAll('.btn-editar').forEach(boton => {
                boton.addEventListener('click', () => {
                    const id = boton.dataset.id;
                    const marca = boton.dataset.marca;
                    const modelo = boton.dataset.modelo;

                    document.getElementById('modal-id').value = id;
                    document.getElementById('modal-marca').value = marca;
                    document.getElementById('modal-modelo').value = modelo;
                });
            });
            
            // Eliminar
            document.querySelectorAll('.btn-eliminar').forEach(boton => {
                boton.addEventListener('click', () => {
                    const id = boton.dataset.id;
                    const marca = boton.dataset.marca;
                    const modelo = boton.dataset.modelo;

                    // Llenar inputs ocultos
                    document.getElementById('modal_eliminar-id').value = id;
                    document.getElementById('modal_eliminar-marca').value = marca;
                    document.getElementById('modal_eliminar-modelo').value = modelo;
                    
                    // Llenar texto visual de confirmación
                    document.getElementById('modal_eliminar-marca-display').textContent = marca;
                    document.getElementById('modal_eliminar-modelo-display').textContent = modelo;
                });
            });
        });
