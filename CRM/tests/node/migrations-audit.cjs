// Dedicated databases inside the isolated crm-auth-audit MySQL instance only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const args = ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml'];
const prefix = `crm_migration_${Date.now()}`;
const databases = [];
const runtimeUser = `crm_runtime_${Date.now()}`;
let runtimeCreated = false;
let checks = 0;
function sql(query) {
  return execFileSync('docker', [...args, 'exec', '-T', 'db', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --batch --skip-column-names'], { cwd: process.cwd(), input: query, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}
function make(suffix) {
  const name = `${prefix}_${suffix}`;
  sql(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON \`${name}\`.* TO 'crm'@'%';`);
  databases.push(name);
  const operational = fs.readFileSync('docker/mysql/init/001-schema.sql','utf8').split('-- Authentication baseline.')[0];
  sql(`USE \`${name}\`;` + operational);
  return name;
}
function migrate(name) {
  return execFileSync('docker', [...args, 'run', '--rm', '-T', '--no-deps', '-e', `DB_NAME=${name}`, '-e', 'NODE_ENV=test', 'app', 'npm', 'run', 'migrate'], {cwd:process.cwd(),encoding:'utf8',stdio:['pipe','pipe','pipe']});
}
function equal(a,b,message){assert.equal(a,b,message);checks++;}
try {
  const fresh=make('fresh'),empty=make('empty'),legacy=make('legacy'),missing=make('missing');
  sql(`USE \`${fresh}\`;\n`+fs.readFileSync('docker/mysql/init/001-schema.sql','utf8'));
  for (const table of ['usuarios','sesiones_usuario','desafios_login','recuperaciones_password']) equal(sql(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${fresh}' AND table_name='${table}';`),'1',`base schema includes ${table}`);
  assert(migrate(fresh).includes('aplicada'));checks++;
  assert(migrate(empty).includes('aplicada'));checks++;
  const columns=name=>sql(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>') FROM information_schema.columns WHERE table_schema='${name}' AND TABLE_NAME IN ('usuarios','sesiones_usuario','desafios_login','recuperaciones_password') ORDER BY TABLE_NAME,ORDINAL_POSITION;`);
  equal(columns(fresh),columns(empty),'new schema and migration agree');
  const before=columns(empty);assert(migrate(empty).includes('ya aplicada'));checks++;
  equal(columns(empty),before,'repeat does not alter schema');
  equal(sql(`SELECT COUNT(*) FROM \`${empty}\`.schema_migrations;`),'4','four migration ledger entries');
  sql(`USE \`${legacy}\`; ALTER TABLE Tickets DROP COLUMN Fecha_cierre;
  INSERT INTO Cliente(Nombre_empresa,Encargado,Numero) VALUES('legacy service','QA','5512345678');
  INSERT INTO Tickets(ID_cliente,Tipo_servicio,Estatus_servicio,Numero_unidades,Fecha_servicio) VALUES(1,'Instalacion','Finalizado',1,'2020-01-01');
  CREATE TABLE usuarios (id INT PRIMARY KEY AUTO_INCREMENT,correo VARCHAR(254) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,rol ENUM('admin','usuario') NOT NULL DEFAULT 'usuario',creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
  INSERT INTO usuarios (correo,password_hash,rol) VALUES ('admin@legacy.example','preserved-admin-hash','admin'),('user@legacy.example','preserved-user-hash','usuario');
  CREATE TABLE sesiones_usuario (token_hash CHAR(64) PRIMARY KEY,id_usuario INT NOT NULL,expira_en DATETIME NOT NULL,FOREIGN KEY(id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE) ENGINE=InnoDB;
  INSERT INTO sesiones_usuario VALUES (REPEAT('a',64),1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR));
  CREATE TABLE retained_data(id INT PRIMARY KEY,value VARCHAR(50)); INSERT INTO retained_data VALUES(1,'preserved');`);
  migrate(legacy);
  equal(sql(`SELECT Fecha_cierre IS NULL FROM \`${legacy}\`.Tickets WHERE ID_ticket=1;`),'1','legacy closure date not fabricated');
  equal(sql(`SELECT COUNT(*) FROM \`${legacy}\`.ticket_historial;`),'0','no invented legacy history');
  equal(sql(`SELECT GROUP_CONCAT(rol ORDER BY id) FROM \`${legacy}\`.usuarios;`),'admin,coordinador','legacy roles migrated without demoting admin');
  equal(sql(`SELECT GROUP_CONCAT(password_hash ORDER BY id) FROM \`${legacy}\`.usuarios;`),'preserved-admin-hash,preserved-user-hash','password hashes preserved');
  equal(sql(`SELECT COUNT(*),MAX(segundo_factor) FROM \`${legacy}\`.sesiones_usuario;`),'1\t0','old sessions retained with unverified flag');
  equal(sql(`SELECT value FROM \`${legacy}\`.retained_data;`),'preserved','unrelated data retained');
  assert(migrate(legacy).includes('ya aplicada'));checks++;
  sql(`USE \`${missing}\`; CREATE TABLE usuarios(id INT PRIMARY KEY AUTO_INCREMENT,correo VARCHAR(254) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;INSERT INTO usuarios(correo,password_hash) VALUES('old@example.com','preserved');`);
  migrate(missing);equal(sql(`SELECT correo,rol,password_hash FROM \`${missing}\`.usuarios;`),'old@example.com\tcoordinador\tpreserved','missing role column added without deleting account');
  sql(`USE \`${fresh}\`; INSERT INTO usuarios(correo,password_hash,rol) VALUES('cascade@example.com','fake-hash','tecnico'); SET @id=LAST_INSERT_ID();
  INSERT INTO sesiones_usuario(token_hash,id_usuario,expira_en,segundo_factor) VALUES(REPEAT('b',64),@id,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR),1);
  INSERT INTO desafios_login(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) VALUES(REPEAT('c',64),@id,REPEAT('d',64),REPEAT('e',64),UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE));`);
  assert.throws(()=>sql(`USE \`${fresh}\`;INSERT INTO desafios_login(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) SELECT REPEAT('f',64),id_usuario,code_hash,credential_hash,creado_en,expira_en FROM desafios_login;`));checks++;
  sql(`USE \`${fresh}\`; INSERT INTO recuperaciones_password(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) SELECT REPEAT('9',64),id,REPEAT('8',64),REPEAT('7',64),UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE) FROM usuarios WHERE correo='cascade@example.com';`);
  assert.throws(()=>sql(`USE \`${fresh}\`; INSERT INTO recuperaciones_password(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) SELECT REPEAT('6',64),id_usuario,code_hash,credential_hash,creado_en,expira_en FROM recuperaciones_password;`));checks++;
  sql(`DELETE FROM \`${fresh}\`.usuarios WHERE correo='cascade@example.com';`);
  equal(sql(`SELECT COUNT(*) FROM \`${fresh}\`.recuperaciones_password;`),'0','recovery deleted by FK cascade');
  equal(sql(`SELECT COUNT(*) FROM \`${fresh}\`.desafios_login;`),'0','challenge deleted by FK cascade');
  equal(sql(`SELECT COUNT(*) FROM \`${fresh}\`.sesiones_usuario;`),'0','session deleted by FK cascade');
  sql(`CREATE USER '${runtimeUser}'@'%' IDENTIFIED BY 'runtime-audit-only'; GRANT SELECT,INSERT,UPDATE,DELETE ON \`${fresh}\`.* TO '${runtimeUser}'@'%';`);
  runtimeCreated = true;
  const runtimeCode = "const {database}=require('./dist/infrastructure/database/connection');(async()=>{try{await require('./dist/auth').initializeAuthentication();console.log('runtime without DDL permissions OK')}finally{await database.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});";
  const output = execFileSync('docker', [...args,'run','--rm','-T','--no-deps','-e',`DB_NAME=${fresh}`,'-e',`DB_USER=${runtimeUser}`,'-e','DB_PASSWORD=runtime-audit-only','-e','NODE_ENV=test','app','node','-e',runtimeCode],{cwd:process.cwd(),encoding:'utf8',stdio:['pipe','pipe','pipe']});
  assert(output.includes('runtime without DDL permissions OK'));checks++;
  console.log(`PASS ${checks} checks: fresh schema, empty/existing/legacy DB migrations, repeat execution, data retention, unique challenge and FK cascades`);
} finally {
  if (runtimeCreated) sql(`DROP USER '${runtimeUser}'@'%';`);
  for (const name of databases) sql(`DROP DATABASE \`${name}\`;`);
}
