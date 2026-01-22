document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn_confirmar_cliente').forEach(boton => {
      boton.addEventListener('click', () => {
        const id = boton.dataset.id;
        const nombre = boton.dataset.nombre;
        const encargado = boton.dataset.encargado;
        const numero = boton.dataset.numero;
        document.getElementById('id_cliente').value = id;
        document.getElementById('nombre_cliente').value = nombre;
        document.getElementById('encargado').value = encargado;
        document.getElementById('telefono_cliente').value = numero;
      });
    });

    document.querySelectorAll('.btn_confirmar_tecnico').forEach(boton => {
      boton.addEventListener('click', () => {

        const id = boton.dataset.id;
        const nombre = boton.dataset.nombre;
        const numero = boton.dataset.numero;
        

        document.getElementById('id_tecnico').value = id;
        document.getElementById('nombre_tecnico').value = nombre;
        document.getElementById('numero_tecnico').value = numero;
        
      });
    });
    document.querySelectorAll('.btn_tecnico_pendiente').forEach(boton => {
      boton.addEventListener('click', () => {
        document.getElementById('id_tecnico').value = 'null';
        document.getElementById('nombre_tecnico').value = 'Pendiente';
        document.getElementById('numero_tecnico').value = '#';
      });
    });

    
    const btnPendiente = document.getElementById('btn_ubicacion_pendiente');
        const inputDireccion = document.getElementById('direccion_servicio');

        if(btnPendiente && inputDireccion) {
            btnPendiente.addEventListener('click', () => {
                inputDireccion.value = "Pendiente";
                inputDireccion.focus();
            });
    }


    const input = document.getElementById('numero_unidades');
    input.addEventListener('input', function (e) {
    let value = e.target.value;
    if (value !== '0') {
      value = value.replace(/^0+/, '');
    }
    e.target.value = value;

    });

    const fechaInput = document.getElementById("fecha");
    const ahora = new Date();

    
    const formatoMin = ahora.toISOString().slice(0, 16);
    fechaInput.min = formatoMin;


});