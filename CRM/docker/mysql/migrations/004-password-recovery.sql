CREATE TABLE IF NOT EXISTS recuperaciones_password (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE,
  code_hash CHAR(64) NOT NULL,
  credential_hash CHAR(64) NOT NULL,
  intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  enviado TINYINT NOT NULL DEFAULT 0,
  creado_en DATETIME NOT NULL,
  expira_en DATETIME NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
