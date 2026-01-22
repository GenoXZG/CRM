
   
        document.addEventListener('DOMContentLoaded', () => {
            // Editar
            document.querySelectorAll('.btn-editar').forEach(boton => {
                boton.addEventListener('click', () => {
                    const id = boton.dataset.id;
                    const nombre = boton.dataset.nombre;

                    document.getElementById('modal-id').value = id;
                    document.getElementById('modal-nombre_accesorio').value = nombre;
                });
            });
            
            // Eliminar
            document.querySelectorAll('.btn-eliminar').forEach(boton => {
                boton.addEventListener('click', () => {
                    const id = boton.dataset.id;
                    const nombre = boton.dataset.nombre;
                    
                    document.getElementById('modal_eliminar-id').value = id;
                    document.getElementById('modal_eliminar-nombre').value = nombre;
                    
                    // Texto visual
                    document.getElementById('modal_eliminar-nombre-display').textContent = nombre;
                });
            });
        });
