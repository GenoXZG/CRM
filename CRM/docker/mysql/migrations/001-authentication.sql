-- Authentication baseline. Safe to apply to existing databases; preserves rows.
CREATE TABLE IF NOT EXISTS usuarios (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  correo VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'coordinador',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones_usuario (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  id_usuario INT NOT NULL,
  expira_en DATETIME NOT NULL,
  segundo_factor TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desafios_login (
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
