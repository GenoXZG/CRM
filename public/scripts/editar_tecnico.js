document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-editar').forEach(boton => {
      boton.addEventListener('click', () => {

        const id = boton.dataset.id;
        const nombre = boton.dataset.nombre;
        const numero = boton.dataset.numero;
        const estatus = boton.dataset.estatus;

        document.getElementById('modal-id').value = id;
        document.getElementById('modal-nombre').value = nombre;
        document.getElementById('modal-numero').value = numero;
        document.getElementById('modal-estatus').value = estatus;
      });
    });
     
    document.querySelectorAll('.btn-eliminar').forEach(boton => {
    boton.addEventListener('click', () => {
        var id = boton.dataset.id;
        var nombre = boton.dataset.nombre;
        document.getElementById('modal_eliminar-id').value = id;
        document.getElementById('modal_eliminar-nombre').value = nombre;
    });
    });
  });
