document.addEventListener('DOMContentLoaded', () => {

    const cardAsignacion = document.getElementById('card-asignacion');
    const lblCliente = document.getElementById('lbl-cliente-seleccionado');
    const lblTicket = document.getElementById('lbl-ticket-seleccionado');

    // Función para cancelar/ocultar el formulario
    window.cancelarAsignacion = function() {
        cardAsignacion.classList.add('d-none');
        document.getElementById('cuerpo_tabla_unidades').innerHTML = '';
        // Scroll suave hacia arriba
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function cargarMarcas() {
        try {
            // Ajusta esta ruta si tu endpoint real es diferente
            const response = await fetch('/test'); // O '/api/marcas'
            const marcas = await response.json();
            return marcas;
        } catch (error) {
            console.error("Error al cargar marcas:", error);
            return [];
        }
    }

    document.querySelectorAll('.btn_seleccion_ticket').forEach(boton => {
        boton.addEventListener('click', function () {
            
            const ticketID = this.dataset.id_ticket;
            const clienteNombre = this.dataset.cliente;
            const numUnidades = parseInt(this.dataset.num_unidades);

            // 1. Mostrar la tarjeta de asignación
            cardAsignacion.classList.remove('d-none');
            
            // 2. Actualizar etiquetas informativas
            lblCliente.textContent = clienteNombre;
            lblTicket.textContent = ticketID;

            // 3. Habilitar botón y generar filas
            const btnRegistro = document.getElementById('btn_registrar_unidad');
            btnRegistro.disabled = false;

            generarFilas(numUnidades, ticketID);

            // 4. Scroll suave hacia el formulario
            cardAsignacion.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // 5. Lógica de cambio de Marca -> Modelo
            const cuerpo = document.getElementById('cuerpo_tabla_unidades');
            // Removemos listeners previos clonando el nodo (truco rápido) o cuidando no duplicar
            // En este caso, como generamos el HTML desde cero, el listener delegado está bien.
        });
    });

    // Delegación de eventos para el cambio de marca (más eficiente)
    document.getElementById('cuerpo_tabla_unidades').addEventListener('change', async (e) => {
        const target = e.target;
        if (target.matches('.select_marca')) {
            const marca = target.value;
            const fila = target.closest('tr');
            const selectModelo = fila.querySelector('.select_modelo');
            
            // Feedback visual de carga
            selectModelo.innerHTML = '<option selected disabled>Cargando...</option>';

            try {
                const modelos = await fetch(`/modelos?marca=${marca}`).then(res => res.json());
                
                let options = '<option value="" selected disabled>-- Seleccionar Modelo --</option>';
                if(modelos.length > 0) {
                    modelos.forEach(modelo => {
                        options += `<option value="${modelo.ID_Unidad_modelo}">${modelo.Modelo_Unidad}</option>`;
                    });
                } else {
                    options = '<option value="" disabled>Sin modelos registrados</option>';
                }
                selectModelo.innerHTML = options;
            } catch (error) {
                console.error(error);
                selectModelo.innerHTML = '<option value="" disabled>Error al cargar</option>';
            }
        }
    });

    async function generarFilas(numFilas, ID_ticket) {
        const cuerpo = document.getElementById('cuerpo_tabla_unidades');
        cuerpo.innerHTML = '<tr><td colspan="4" class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><span class="ms-2">Cargando formulario...</span></td></tr>';
        
        const marcas = await cargarMarcas();

        cuerpo.innerHTML = ''; // Limpiar spinner

        for (let i = 0; i < numFilas; i++) {
            const fila = document.createElement('tr');

            let options = '<option value="" selected disabled>-- Seleccionar Marca --</option>';
            marcas.forEach(marca => {
                options += `<option value="${marca.Marca_unidad}">${marca.Marca_unidad}</option>`;
            });

            // Usamos clases bg-light y border-0 para inputs estilo Soft UI
            fila.innerHTML = `
                <input type="hidden" value="${numFilas}" name="numRegistros">
                <input type="hidden" value="${ID_ticket}" name="id_ticket" class="ticket-id-hidden">
                <td class="p-3">
                    <select class="form-select select_marca bg-light border-0" name="marca" required>
                        ${options}
                    </select>
                </td>
                <td class="p-3"> 
                    <select class="form-select select_modelo bg-light border-0" name="modelo" required>
                        <option value="" selected disabled>Primero seleccione marca</option>
                    </select>
                </td>
                <td class="p-3">
                    <input class="form-control bg-light border-0" type="text" name="placa_unidad" placeholder="EJ: ABC-123" required>
                </td>
                <td class="p-3">
                    <input class="form-control bg-light border-0" type="text" name="vin_unidad" placeholder="17 dígitos..." required>
                </td>
            `;

            cuerpo.appendChild(fila);
        }
    }

    document.getElementById('form_unidades').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Obtener ID del ticket de la primera fila generada
        const hiddenInput = document.querySelector('.ticket-id-hidden');
        if(!hiddenInput) return;
        
        const ticketId = hiddenInput.value;

        const unidades = Array.from(document.querySelectorAll('#cuerpo_tabla_unidades tr')).map((fila) => ({
            modelo: fila.querySelector('select[name="modelo"]').value,
            placa: fila.querySelector('input[name="placa_unidad"]').value,
            vin: fila.querySelector('input[name="vin_unidad"]').value,
            ticketId: ticketId
        }));

        try {
            const response = await fetch('/add_unidades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unidades })
            });

            const data = await response.json();

            if (data.success) {
                // Alerta bonita con SweetAlert2
                if(typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Asignación Exitosa!',
                        text: 'Las unidades han sido registradas correctamente.',
                        confirmButtonColor: '#4318ff',
                        timer: 2000
                    }).then(() => location.reload());
                } else {
                    alert('Unidad registrada con éxito');
                    location.reload();
                }
            } else {
                if(typeof Swal !== 'undefined') {
                    Swal.fire('Error', 'No se pudo registrar la unidad', 'error');
                } else {
                    alert('No se pudo registrar la unidad');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error de conexión');
        }
    });

});