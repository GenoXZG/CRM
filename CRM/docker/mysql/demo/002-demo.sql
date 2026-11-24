-- Fictional data, loaded only when initializing an empty volume.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO Cliente (ID_cliente, Nombre_empresa, Encargado, Numero) VALUES
(1, 'Transportes Demo', 'Contacto Demo Uno', '5550000001'),
(2, 'Logística Ejemplo', 'Contacto Demo Dos', '5550000002');
INSERT INTO Tecnicos (ID_Tecnico, Nombre_tecnico, Estatus_tecnico, Numero_tecnico) VALUES
(1, 'Técnico Demo Activo', 'Activo', '5550000011'),
(2, 'Técnico Demo Histórico', 'Inactivo', '5550000012');
INSERT INTO Equipos_catalogo (ID_equipo_modelo, Marca_equipo, Modelo_equipo) VALUES
(1, 'Marca Demo', 'GPS Demo A'), (2, 'Marca Demo', 'GPS Demo B');
INSERT INTO Unidades_catalogo (ID_Unidad_modelo, Marca_unidad, Modelo_Unidad) VALUES
(1, 'Vehículo Demo', 'Camión A'), (2, 'Vehículo Demo', 'Camioneta B');
INSERT INTO Accesorios_catalogo (ID_accesorio_modelo, Nombre_accesorio) VALUES
(1, 'Botón de pánico Demo'), (2, 'Sensor Demo');
INSERT INTO Equipos (ID_equipo, ID_equipo_modelo, IMEI, ID_modem, Estatus_equipo) VALUES
(1,1,'990000000000001','DEMO-001','Asignado'),
(2,1,'990000000000002','DEMO-002','Asignado'),
(3,2,'990000000000003','DEMO-003','Asignado'),
(4,2,'990000000000004','DEMO-004','En espera'),
(5,1,'990000000000005','DEMO-005','En espera'),
(6,2,'990000000000006','DEMO-006','En espera');
INSERT INTO Tickets (ID_ticket, ID_tecnico, ID_cliente, Tipo_servicio, Estatus_servicio, Numero_unidades, Fecha_servicio, Comentarios, Estatus_unidades) VALUES
(1,NULL,1,'Instalacion','En espera',2,'2026-12-01 09:00:00','DEMO: registrar dos unidades y asignar técnico.',0),
(2,1,1,'Instalacion','En seguimiento',2,'2026-12-02 10:00:00','DEMO: completar asignación parcial.',2),
(3,1,2,'Revision','En seguimiento',1,'2026-12-03 11:00:00','DEMO: asignación completa, listo para finalizar.',1),
(4,2,2,'Instalacion','Finalizado',1,'2026-10-01 12:00:00','DEMO: historial de técnico inactivo y reapertura.',1),
(5,1,2,'Instalacion','En seguimiento',1,'2026-12-04 12:00:00','DEMO: asignación pendiente.',0);
INSERT INTO Unidades (ID_unidad, ID_Unidad_modelo, ID_equipo, ID_ticket, Placa_unidad, Vin_unidad) VALUES
(1,1,1,2,'DEMO-01','DEMO0000000000001'),
(2,2,NULL,2,'DEMO-02','DEMO0000000000002'),
(3,1,2,3,'DEMO-03','DEMO0000000000003'),
(4,2,3,4,'DEMO-04','DEMO0000000000004'),
(5,1,NULL,5,'DEMO-05','DEMO0000000000005');
INSERT INTO Unidad_Accesorio (ID_unidad, ID_accesorio) VALUES (1,1), (3,2);
COMMIT;
