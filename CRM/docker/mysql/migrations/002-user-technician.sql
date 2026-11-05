-- Existing users remain unlinked until an administrator selects a technician.
ALTER TABLE usuarios ADD COLUMN id_tecnico INT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_tecnico (id_tecnico);
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_tecnico FOREIGN KEY (id_tecnico)
  REFERENCES Tecnicos(ID_Tecnico) ON DELETE RESTRICT ON UPDATE CASCADE;
