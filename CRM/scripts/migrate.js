// Explicit schema migrations. Run after building, before starting the application.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createConnection } = require('mysql2/promise');
const { configuration, rootDirectory } = require('../dist/config');

async function upgradeLegacyAuthentication(connection) {
  const [roles] = await connection.query("SHOW COLUMNS FROM usuarios LIKE 'rol'");
  if (!roles.length) {
    await connection.query("ALTER TABLE usuarios ADD COLUMN rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'coordinador'");
  } else if (roles[0].Type.includes("'usuario'")) {
    await connection.query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','usuario','coordinador','tecnico') NOT NULL DEFAULT 'coordinador'");
    await connection.query("UPDATE usuarios SET rol='coordinador' WHERE rol='usuario'");
    await connection.query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'coordinador'");
  }
  const [factors] = await connection.query("SHOW COLUMNS FROM sesiones_usuario LIKE 'segundo_factor'");
  if (!factors.length) await connection.query('ALTER TABLE sesiones_usuario ADD COLUMN segundo_factor TINYINT NOT NULL DEFAULT 0');
}
async function linkUserTechnician(connection, sql) {
  const [columns] = await connection.query("SHOW COLUMNS FROM usuarios LIKE 'id_tecnico'");
  if (!columns.length) await connection.query(sql);
  // Complete a partially applied DDL migration, or recognize the current base schema.
  const [indexes] = await connection.query("SHOW INDEX FROM usuarios WHERE Key_name='uq_usuarios_tecnico'");
  if (!indexes.length) await connection.query('ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_tecnico (id_tecnico)');
  const [keys] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND CONSTRAINT_NAME='fk_usuarios_tecnico'");
  if (!keys.length) await connection.query('ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_tecnico FOREIGN KEY (id_tecnico) REFERENCES Tecnicos(ID_Tecnico) ON DELETE RESTRICT ON UPDATE CASCADE');
}
async function addTicketClosedAt(connection) {
  const [columns] = await connection.query("SHOW COLUMNS FROM Tickets LIKE 'Fecha_cierre'");
  if (!columns.length) await connection.query('ALTER TABLE Tickets ADD COLUMN Fecha_cierre DATETIME(3) NULL AFTER Fecha_servicio');
}
const migrations = [
  { id: '001-authentication', file: '001-authentication.sql', upgrade: upgradeLegacyAuthentication },
  { id: '002-user-technician', file: '002-user-technician.sql', apply: linkUserTechnician },
  { id: '003-ticket-history', file: '003-ticket-history.sql', upgrade: addTicketClosedAt },
  { id: '004-password-recovery', file: '004-password-recovery.sql' },
];
async function migrate() {
  const settings = configuration.database;
  // A dedicated connection keeps the advisory lock across MySQL DDL implicit commits.
  const connection = await createConnection({ host: settings.host, port: settings.port, database: settings.name, user: settings.user, password: settings.password, multipleStatements: true });
  const lockName = 'crm-migrate-' + createHash('sha256').update(settings.name).digest('hex').slice(0, 40);
  let locked = false;
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?,30) AS acquired', [lockName]);
    if (Number(rows[0].acquired) !== 1) throw new Error('No se pudo obtener el bloqueo de migraciones');
    locked = true;
    await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) NOT NULL PRIMARY KEY, aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
    for (const migration of migrations) {
      const [applied] = await connection.query('SELECT id FROM schema_migrations WHERE id=?', [migration.id]);
      if (applied.length) { console.log(`${migration.id}: ya aplicada`); continue; }
      const sql = await fs.readFile(path.join(rootDirectory, 'docker/mysql/migrations', migration.file), 'utf8');
      if (migration.apply) await migration.apply(connection, sql);
      else { await connection.query(sql); if (migration.upgrade) await migration.upgrade(connection); }
      // MySQL DDL is not transactional. Steps are repeatable; record only after success.
      await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
      console.log(`${migration.id}: aplicada`);
    }
  } finally {
    try { if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); }
    finally { await connection.end(); }
  }
}
migrate().catch(error => {
  console.error('No se pudo aplicar la migración:', error.code || error.name || 'Error');
  process.exitCode = 1;
});
