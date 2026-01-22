// Gestión del Estado Local
const estadoAsignaciones = {
    asignaciones: {}, 
    accesorios: {},   

    // --- Lógica Equipos ---
    agregarAsignacion(unidadId, equipoId) {
      // Validar si el equipo ya se usó en otra unidad LOCALMENTE
      const unidadExistente = this.obtenerUnidadPorEquipo(equipoId);
      if (unidadExistente && unidadExistente !== unidadId) {
        return { success: false, message: `Este equipo ya está asignado a otra unidad en esta sesión.` };
      }
      this.asignaciones[unidadId] = equipoId;
      return { success: true, message: 'Asignación lista' };
    },
    
    eliminarAsignacion(unidadId) {
      if (this.asignaciones[unidadId]) {
        delete this.asignaciones[unidadId];
        return { success: true };
      }
      return { success: false };
    },
    
    obtenerUnidadPorEquipo(equipoId) {
      for (const [unidadId, eqId] of Object.entries(this.asignaciones)) {
        if (eqId === equipoId) return unidadId;
      }
      return null;
    },

    // --- Lógica Accesorios (CON SOPORTE READ-ONLY) ---
    // Ahora aceptamos un 4to parámetro opcional 'isReadOnly'
    agregarAccesorio(unidadId, accId, nombre, isReadOnly = false) { 
        if (!this.accesorios[unidadId]) {
            this.accesorios[unidadId] = [];
        }
        
        // Evitar duplicados
        if (this.accesorios[unidadId].some(a => a.id == accId)) {
            return { success: false, message: 'Este accesorio ya está agregado.' };
        }
        
        this.accesorios[unidadId].push({ 
            id: accId, 
            nombre,
            readOnly: isReadOnly // <--- NUEVA PROPIEDAD
        }); 
        return { success: true };
    },

    eliminarAccesorio(unidadId, index) {
        if (this.accesorios[unidadId] && this.accesorios[unidadId][index]) {
            // Protección extra: No borrar si es readOnly
            if(this.accesorios[unidadId][index].readOnly) {
                return { success: false, message: 'No se puede eliminar un accesorio guardado.' };
            }
            this.accesorios[unidadId].splice(index, 1);
            return { success: true };
        }
        return { success: false };
    },
    
    toJSON() {
      // Al enviar al backend, filtramos solo lo que NO es readOnly (lo nuevo)
      // Ojo: Depende de tu backend. Si tu backend es "Idempotente" (findOrCreate), 
      // puedes enviar todo. Si solo espera lo nuevo, filtra aquí.
      // Como hicimos el backend idempotente, enviamos todo sin problemas.
      return {
          equipos: this.asignaciones,
          accesorios: this.accesorios
      };
    }
};
  
  document.addEventListener('DOMContentLoaded', () =>{ 
  
      const idTicket = document.getElementById('ID_ticket');
      const clienteTicket = document.getElementById('Cliente_Ticket');
      const tecnicoTicket = document.getElementById('Tecnico_Ticket');
      const unidadesTicket = document.getElementById('Unidades_Ticket');
      
      const workbenchContainer = document.getElementById('workbench-container');
      const loadingIndicator = document.getElementById('loading-indicator');
  
      // --- SELECCIÓN DE TICKET ---
    document.querySelectorAll('.btn_seleccion_ticket').forEach(boton => {
        boton.addEventListener('click', async function () {
            // Resetear estado completo
            estadoAsignaciones.asignaciones = {};
            estadoAsignaciones.accesorios = {};

            const ticket = this.dataset.id_ticket; // ID del ticket seleccionado
            const cliente = this.dataset.cliente;
            const tecnico = this.dataset.tecnico;
            const unidades = this.dataset.num_unidades;

            // Actualizar Header (Textos existentes)
            idTicket.textContent = ticket;
            clienteTicket.textContent = cliente;
            tecnicoTicket.textContent = tecnico;
            unidadesTicket.textContent = unidades;

           
            const btnDetalles = document.getElementById('btn_ver_detalles');
            if (btnDetalles) {
                btnDetalles.href = `/detalle_ticket/${ticket}`;
            }

            // UX: Mostrar loader y ocultar workbench previo
            workbenchContainer.classList.add('d-none');
            loadingIndicator.classList.remove('d-none');
            
            // ... resto de tu código (cargarUnidadesConEquipos, scroll, etc) ...
            loadingIndicator.scrollIntoView({ behavior: 'smooth' });

            await cargarUnidadesConEquipos(ticket);

            loadingIndicator.classList.add('d-none');
            workbenchContainer.classList.remove('d-none');
            
            document.getElementById('btn_confirmar_asignaciones').hidden = false;
        });
    });
  });
  
async function cargarUnidadesConEquipos(idTicket) {
    try {
        const response = await fetch(`/unidades-por-ticket/${idTicket}`);
        const unidades = await response.json();
        
        const contenedor = document.getElementById('contenedor-unidades-equipos');
        contenedor.innerHTML = '';
        
        // Limpiamos estado previo
        estadoAsignaciones.asignaciones = {};
        estadoAsignaciones.accesorios = {};
        
        if (!unidades || unidades.length === 0) {
            contenedor.innerHTML = `
                <div class="col-12 text-center py-5 text-muted soft-card">
                    <i class="bi bi-exclamation-circle fs-1"></i>
                    <p class="mt-3">No hay unidades registradas en este ticket.</p>
                </div>`;
            return;
        }
        
        unidades.forEach(unidad => {
            const rowId = `unidad-row-${unidad.ID_Unidad}`;

            // 1. DETERMINAR SI VIENE DE BD (LECTURA)
            const tieneEquipo = !!unidad.Equipo;
            const esSoloLectura = tieneEquipo; // Si tiene equipo al cargar, es de BD (Solo Lectura)

            // --- LÓGICA DE EQUIPO ---
            let htmlEquipoInfo = '';
            let htmlAvisoBloqueo = '';
            // Control de visualización de botones: Si es solo lectura, display:none
            const displayBotones = esSoloLectura ? 'none' : 'flex';

            if (tieneEquipo) {
                // Registrar en estado local
                estadoAsignaciones.asignaciones[unidad.ID_Unidad] = unidad.Equipo.ID_equipo;

                const modeloGPS = unidad.Equipo.Equipo_stock ? unidad.Equipo.Equipo_stock.Modelo_equipo : 'GPS Genérico';
                
                htmlEquipoInfo = `
                    <div class="d-flex align-items-center mb-1">
                        <i class="bi bi-hdd-network-fill text-primary me-2"></i>
                        <span class="fw-bold text-dark small">${modeloGPS}</span>
                    </div>
                    <div class="d-flex justify-content-between small text-muted">
                        <span>IMEI: ${unidad.Equipo.IMEI}</span>
                    </div>
                `;

                if (esSoloLectura) {
                    // MODO SOLO LECTURA: Mensaje de bloqueo limpio
                    htmlAvisoBloqueo = `
                        <div class="mt-2">
                            <div class="alert alert-light border border-secondary border-opacity-25 d-flex align-items-center justify-content-center p-2 mb-0 text-secondary small"
                                 style="background-color: #f8f9fa;"
                                 data-bs-toggle="tooltip" 
                                 data-bs-placement="top"
                                 title="Este equipo y sus accesorios están vinculados a la Unidad. Para modificarlos, vaya a 'Detalles del Ticket'.">
                                <i class="bi bi-lock-fill me-2"></i> Asignado (Solo Lectura)
                            </div>
                        </div>
                    `;
                }
            }

            // --- LÓGICA DE ACCESORIOS (CARGA INICIAL) ---
            if (unidad.Accesorio_stocks && unidad.Accesorio_stocks.length > 0) {
                unidad.Accesorio_stocks.forEach(acc => {
                    estadoAsignaciones.agregarAccesorio(
                        unidad.ID_Unidad, 
                        acc.ID_accesorio_modelo, 
                        acc.Nombre_accesorio, 
                        true // <--- TRUE: Es Read Only
                    );
                });
            }

            // --- DEFINICIÓN DE CLASES VISUALES ---
            const cardClass = tieneEquipo ? 'unit-card assigned' : 'unit-card pending';
            const displayVacio = tieneEquipo ? 'none' : 'block';
            const displayLleno = tieneEquipo ? 'block' : 'none';

            // --- CONSTRUCCIÓN DEL HTML ---
            const col = document.createElement('div');
            col.className = 'col-lg-6 mb-4';
            
            let htmlBotonAccesorios = '';
            if (!esSoloLectura) {
                htmlBotonAccesorios = `
                    <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill py-0 btn-abrir-accesorios"
                        data-unidad-id="${unidad.ID_Unidad}"
                        data-bs-toggle="modal" 
                        data-bs-target="#modalSeleccionAccesorio">
                        <i class="bi bi-plus"></i>
                    </button>
                `;
            }


            col.innerHTML = `
                <div class="soft-card h-100 p-0 overflow-hidden ${cardClass}" id="${rowId}">
                    <div class="row g-0 h-100">
                        
                        <div class="col-md-6 p-4 bg-light d-flex flex-column justify-content-center border-end">
                            <h5 class="mb-3 d-flex align-items-center">
                                <i class="bi bi-car-front-fill me-2 text-secondary"></i>
                                ${unidad.Unidad_stock ? unidad.Unidad_stock.Modelo_unidad : 'N/D'}
                            </h5>
                            <div class="fw-bold text-dark mb-3">${unidad.Unidad_stock ? unidad.Unidad_stock.Marca_unidad : 'N/D'}</div>
                            
                            <div class="small text-muted mb-1">IDENTIFICADORES</div>
                            
                            <div class="font-monospace bg-white p-2 rounded border mb-1 small">
                                <i class="bi bi-card-text me-1 text-muted"></i> ${unidad.Placa_unidad || 'S/P'}
                            </div>
                            
                            <div class="font-monospace bg-white p-2 rounded border small">
                                <i class="bi bi-upc-scan me-1 text-muted"></i> ${unidad.Vin_unidad || 'S/V'}
                            </div>
                        </div>
                        
                        <div class="col-md-6 p-4 d-flex flex-column">
                            <div class="mb-3">
                                <h6 class="text-primary small fw-bold text-uppercase mb-2">
                                    <i class="bi bi-cpu me-1"></i> Equipo GPS
                                </h6>
                                
                                <div id="sin-equipo-${unidad.ID_Unidad}" class="text-center" style="display: ${displayVacio};">
                                    <div class="empty-slot p-3 rounded-4 cursor-pointer btn-seleccionar-equipo"
                                         data-unidad-id="${unidad.ID_Unidad}"
                                         data-bs-toggle="modal"
                                         data-bs-target="#modalSeleccionEquipo">
                                        <i class="bi bi-plus-circle-dotted fs-2 text-muted"></i>
                                        <div class="small text-muted mt-1">Asignar GPS</div>
                                    </div>
                                </div>
                                
                                <div id="equipo-asignado-${unidad.ID_Unidad}" style="display: ${displayLleno};">
                                    <div class="bg-primary bg-opacity-10 p-2 rounded-3 mb-2 border border-primary border-opacity-25" id="equipo-info-${unidad.ID_Unidad}">
                                        ${htmlEquipoInfo}
                                    </div>
                                    
                                    <div class="gap-2 mt-2" id="botones-equipo-${unidad.ID_Unidad}" style="display: ${displayBotones}">
                                        <button class="btn btn-xs btn-outline-primary w-100 rounded-pill btn_cambiar_equipo"
                                            data-unidad-id="${unidad.ID_Unidad}" data-bs-toggle="modal" data-bs-target="#modalSeleccionEquipo">Cambiar</button>
                                        <button class="btn btn-xs btn-outline-danger w-100 rounded-pill btn_eliminar_asignacion"
                                            data-unidad_id="${unidad.ID_Unidad}"><i class="bi bi-x-lg"></i></button>
                                    </div>

                                    ${htmlAvisoBloqueo}
                                </div>
                            </div>
                            
                            <div class="border-top pt-3 mt-auto">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="small fw-bold text-muted text-uppercase"><i class="bi bi-plug me-1"></i> Accesorios</span>
                                     ${htmlBotonAccesorios}
                                </div>
                                <div id="lista-accesorios-${unidad.ID_Unidad}" class="d-flex flex-wrap gap-2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            contenedor.appendChild(col);
            
            // Pintar los accesorios
            renderizarAccesoriosEnTarjeta(unidad.ID_Unidad);
        });

        // Eventos y Tooltips
        asignarEventosDinamicos();
        inicializarTooltips();

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    }
}
  
function asignarEventosDinamicos() {
      // 1. Botón Seleccionar GPS
      document.querySelectorAll('.btn-seleccionar-equipo').forEach(btn => {
          btn.addEventListener('click', function() {
              const unidadId = this.dataset.unidadId;
              document.getElementById('modalSeleccionEquipo').dataset.unidadId = unidadId;
          });
      });
  
      // 2. Botón Cambiar GPS
      document.querySelectorAll('.btn_cambiar_equipo').forEach(btn => {
          btn.addEventListener('click', function() {
              const unidadId = this.dataset.unidadId;
              document.getElementById('modalSeleccionEquipo').dataset.unidadId = unidadId;
          });
      });
  
      // 3. Botón Eliminar GPS
      document.querySelectorAll('.btn_eliminar_asignacion').forEach(btn => {
          btn.addEventListener('click', function() {
              const unidadId = this.dataset.unidad_id;
              
              estadoAsignaciones.eliminarAsignacion(unidadId);
              document.getElementById(`sin-equipo-${unidadId}`).style.display = 'block';
              document.getElementById(`equipo-asignado-${unidadId}`).style.display = 'none';
              
              const card = document.getElementById(`unidad-row-${unidadId}`).querySelector('.unit-card');
              card.classList.remove('assigned');
              card.classList.add('pending');
          });
      });

      document.querySelectorAll('.btn-abrir-accesorios').forEach(btn => {
          btn.addEventListener('click', function() {
              const unidadId = this.dataset.unidadId;
              
              // Guardar referencia y abrir modal
              const modalEl = document.getElementById('modalSeleccionAccesorio');
              modalEl.dataset.unidadId = unidadId; 
              const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
              modal.show();
          });
      });
};
  
  // --- LISTENERS MODAL EQUIPO ---
  document.querySelectorAll('.btn_seleccion_equipo').forEach(btn => {
      btn.addEventListener('click', function () { 
          const unidadId = document.getElementById('modalSeleccionEquipo').dataset.unidadId;
          
          const idEquipo   = this.dataset.id_equipo;
          const modelo     = this.dataset.modelo;
          const imei       = this.dataset.imei;
          const idModem    = this.dataset.id_modem;
  
          const resultado = estadoAsignaciones.agregarAsignacion(unidadId, idEquipo);
          
          if (resultado.success) {
               const equipoInfoDiv = document.getElementById(`equipo-info-${unidadId}`);
               equipoInfoDiv.innerHTML = `
                   <div class="d-flex align-items-center mb-1">
                       <i class="bi bi-hdd-network-fill text-primary me-2"></i>
                       <span class="fw-bold text-dark small">${modelo}</span>
                   </div>
                   <div class="d-flex justify-content-between small text-muted">
                        <span>IMEI: ${imei}</span>
                   </div>
               `;
               document.getElementById(`sin-equipo-${unidadId}`).style.display = 'none';
               document.getElementById(`equipo-asignado-${unidadId}`).style.display = 'block';
               
               const card = document.getElementById(`unidad-row-${unidadId}`).querySelector('.unit-card');
               card.classList.remove('pending');
               card.classList.add('assigned');
          } else {
              Swal.fire('Atención', resultado.message, 'warning');
          }
      });
  });

  document.querySelectorAll('.btn_agregar_accesorio_modal').forEach(btn => {
    btn.addEventListener('click', function() {
        // 1. Obtener datos
        const modalElement = document.getElementById('modalSeleccionAccesorio');
        const unidadId = modalElement.dataset.unidadId;
        
        const idAcc = this.dataset.id;
        const nombre = this.dataset.nombre;
        
        // 2. Procesar lógica
        const resultado = estadoAsignaciones.agregarAccesorio(unidadId, idAcc, nombre);
        
        if(resultado.success) {
            // 3. Actualizar UI
            renderizarAccesoriosEnTarjeta(unidadId);
            
            // 4. CERRAR MODAL MANUALMENTE (Aquí está el arreglo)
            // Usamos getInstance para obtener el modal abierto y cerrarlo controladamente.
            // Esto permite que Bootstrap maneje el scrollbar correctamente.
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        } else {
            // Si falla (duplicado), NO cerramos el modal, solo avisamos.
            // Esto mejora la experiencia de usuario.
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: resultado.message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    });
});
function inicializarTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        // Evitamos reinicializar los que ya existen verificando si tiene la instancia
        if(!bootstrap.Tooltip.getInstance(tooltipTriggerEl)){
            return new bootstrap.Tooltip(tooltipTriggerEl);
        }
    });
};
  // Función para pintar los accesorios en la tarjeta
function renderizarAccesoriosEnTarjeta(unidadId) {
    const contenedor = document.getElementById(`lista-accesorios-${unidadId}`);
    const lista = estadoAsignaciones.accesorios[unidadId] || [];

    contenedor.innerHTML = ''; 

    if (lista.length === 0) {
        contenedor.innerHTML = '<span class="text-muted fst-italic small">Ninguno</span>';
        return;
    }

    lista.forEach((acc, index) => {
        const isLocked = acc.readOnly === true;
        
        // Estilos Diferenciados
        // Locked: Gris, Borde Sutil, Cursor normal (Default)
        // Nuevo: Blanco, Borde Amarillo, Cursor normal
        const badgeClass = isLocked 
            ? 'bg-light text-secondary border-secondary border-opacity-25' 
            : 'bg-white text-dark border-warning'; 
            
        const iconClass = isLocked ? 'bi-lock-fill small' : 'bi-plug-fill text-warning';
        
        // LÓGICA DE LA X:
        // Si está bloqueado (isLocked), deleteBtn es CADENA VACÍA.
        // Si es nuevo, deleteBtn es el icono de basura.
        const deleteBtn = isLocked 
            ? '' 
            : `<i class="bi bi-x text-danger ms-1 cursor-pointer" onclick="removerAccesorioUI('${unidadId}', ${index})"></i>`;

        // Tooltip opcional solo para los bloqueados
        const tooltipAttr = isLocked 
            ? 'data-bs-toggle="tooltip" title="Accesorio asignado a la Unidad"' 
            : '';

        const badgeHTML = `
            <div class="badge border d-flex align-items-center gap-1 shadow-sm ${badgeClass}" ${tooltipAttr}>
                <i class="bi ${iconClass}"></i> ${acc.nombre}
                ${deleteBtn}
            </div>
        `;
        
        contenedor.innerHTML += badgeHTML;
    });

    inicializarTooltips();
}

  // Función global para remover accesorios desde la UI
  window.removerAccesorioUI = function(unidadId, index) {
      estadoAsignaciones.eliminarAccesorio(unidadId, index);
      renderizarAccesoriosEnTarjeta(unidadId);
  };
  
// --- CONFIRMAR TODO ---
const btn_confirmar = document.getElementById('btn_confirmar_asignaciones');
  
  if (btn_confirmar) {
      btn_confirmar.addEventListener('click', async () => {
          const ticketElement = document.getElementById('ID_ticket');
          // Obtenemos el total de unidades esperado desde el encabezado
          const unidadesTotalElement = document.getElementById('Unidades_Ticket');
          
          if (!ticketElement) return;
          
          const idTicket = ticketElement.textContent;
          const totalUnidades = parseInt(unidadesTotalElement.textContent) || 0;
          
          // Obtenemos el estado actual
          const datosCompletos = estadoAsignaciones.toJSON(); 
          const asignadasCount = Object.keys(datosCompletos.equipos).length;

          // 1. VALIDACIÓN BÁSICA: Nada asignado
          if (asignadasCount === 0) {
              Swal.fire('Sin cambios', 'Asigna al menos un equipo GPS antes de confirmar.', 'info');
              return;
          }

          // 2. CONFIGURACIÓN DINÁMICA DE LA ALERTA
          let swalConfig = {
              title: '¿Confirmar asignaciones?',
              text: `Se guardarán los cambios para el ticket #${idTicket}.`,
              icon: 'question',
              confirmButtonColor: '#4318ff',
              confirmButtonText: 'Sí, guardar y finalizar'
          };

          // 3. DETECCIÓN DE ASIGNACIÓN PARCIAL (Aquí está la magia)
          if (asignadasCount < totalUnidades) {
              swalConfig = {
                  title: '⚠️ Asignación Incompleta',
                  html: `
                    Estás asignando equipos a <b>${asignadasCount}</b> de las <b>${totalUnidades}</b> unidades totales.<br>
                    <small class="text-muted">El ticket quedará en estado "Parcial" y podrás continuar después.</small>
                  `,
                  icon: 'warning',
                  confirmButtonColor: '#ffc107', // Color Ámbar de advertencia
                  confirmButtonText: 'Guardar Avance (Parcial)'
              };
          }
      
          // Mostrar la alerta configurada
          const confirm = await Swal.fire({
              ...swalConfig,
              showCancelButton: true,
              cancelButtonText: 'Cancelar'
          });
      
          if (confirm.isConfirmed) {
              try {
                  // Mostrar loading mientras guarda
                  Swal.fire({
                      title: 'Guardando...',
                      text: 'Por favor espere',
                      allowOutsideClick: false,
                      didOpen: () => { Swal.showLoading(); }
                  });

                  const response = await fetch('/asignar_equipos', { 
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          datosAsignacion: datosCompletos, 
                          idTicket: idTicket
                      })
                  });
      
                  const result = await response.json();
      
                  if (result.success) {
                      Swal.fire({
                          icon: 'success',
                          title: '¡Guardado!',
                          text: result.message || 'Cambios aplicados correctamente.',
                          timer: 2000,
                          showConfirmButton: false
                      }).then(() => {
                          // Si fue parcial, recargamos para ver el estado actualizado.
                          // Si fue total, podrías redirigir al dashboard si prefieres.
                          location.reload(); 
                      });
                  } else {
                      Swal.fire('Error', result.error || 'No se pudieron guardar los cambios', 'error');
                  }
              } catch (error) {
                  console.error(error);
                  Swal.fire('Error', 'Fallo de conexión con el servidor', 'error');
              }
          }
      });
};