-- Fecha_cierre is added conditionally by scripts/migrate.js for older installations.
CREATE TABLE IF NOT EXISTS ticket_historial (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ticket INT NOT NULL,
  evento VARCHAR(50) NOT NULL,
  cambios JSON NOT NULL,
  id_usuario INT NULL,
  usuario_correo VARCHAR(254) NULL,
  usuario_rol VARCHAR(20) NULL,
  ocurrido_en DATETIME(3) NOT NULL,
  CONSTRAINT fk_historial_ticket FOREIGN KEY (id_ticket) REFERENCES Tickets(ID_ticket) ON DELETE CASCADE,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX ix_historial_ticket (id_ticket,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
