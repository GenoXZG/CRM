document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-editar').forEach(boton => {
      boton.addEventListener('click', () => {

        const id = boton.dataset.id;
        const nombre = boton.dataset.nombre;
        const encargado = boton.dataset.encargado;
        const numero = boton.dataset.numero;
        document.getElementById('modal-id').value = id;
        document.getElementById('modal-nombre_empresa').value = nombre;
        document.getElementById('modal-nombre_encargado').value = encargado;
        document.getElementById('modal-numero').value = numero;
      });
    });
     
    document.querySelectorAll('.btn-eliminar').forEach(boton => {
    boton.addEventListener('click', () => {
        var id = boton.dataset.id;
        var nombre = boton.dataset.nombre;
        var encargado = boton.dataset.encargado;
        document.getElementById('modal_eliminar-id').value = id;
        document.getElementById('modal_eliminar-nombre').value = nombre;
        document.getElementById('modal_eliminar-encargado').value = encargado;
    });
    });

  });