const { csrfFetch } = require('./csrf-client.cjs');
// Integration audit for the isolated crm-auth-audit Compose project on port 3031.
// Never points its SQL helpers at the working application's database.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const base = 'http://127.0.0.1:3031';
const compose = ['compose', '-p', 'crm-auth-audit', '-f', 'compose.yaml', '-f', 'docker/compose.auth-audit.yaml'];
const marker = `audit_${Date.now()}`;
let checks = 0;
function eq(actual, expected, label) { assert.equal(actual, expected, label); checks++; }
function ok(value, label) { assert(value, label); checks++; }
function db(code) {
  return execFileSync('docker', [...compose, 'exec', '-T', 'app', 'node'], { cwd: process.cwd(), encoding: 'utf8', input: `const m=require('./dist/infrastructure/database/models');(async()=>{try{${code}}finally{await m.database.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});` }).trim();
}
async function request(url, {cookie, method='GET', body, headers={}}={}) {
  const h = {...headers}; if(cookie) h.Cookie=cookie;
  if(body) h['Content-Type']='application/x-www-form-urlencoded';
  return csrfFetch(base+url,{method,headers:h,body:body?new URLSearchParams(body):undefined,redirect:'manual'});
}
function lastMail() {
  return JSON.parse(execFileSync('docker', [...compose, 'exec', '-T', 'app', 'node', '-e', "process.stdout.write(require('fs').readFileSync('/tmp/crm-auth-test-mail.json','utf8'))"], {cwd:process.cwd(),encoding:'utf8'}));
}
async function login(email, password, cookie) {
  // Lift only the code request cooldown for repeat logins inside the isolated test fixture.
  db(`await m.database.query('UPDATE desafios_login d JOIN usuarios u ON u.id=d.id_usuario SET d.creado_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 61 SECOND) WHERE u.correo=?',{replacements:[${JSON.stringify(email)}]});`);
  const r=await request('/login',{method:'POST',body:{correo:email,password},cookie});
  eq(r.status,302,'password step');eq(r.headers.get('location'),'/login/verificar','second factor required');
  const cookies=r.headers.getSetCookie();const pending=cookies.find(c=>c.startsWith('crm_pending='));ok(pending,'challenge cookie');
  ok(!cookies.some(c=>c.startsWith('crm_session=')&&!c.includes('Max-Age=0')),'no session before code');
  const mail=lastMail();ok(/^\d{6}$/.test(mail.code),'six digit code');eq(mail.to,'shared@audit.example','temporary common recipient');
  const verified=await request('/login/verificar',{method:'POST',cookie:pending.split(';')[0],body:{code:mail.code}});
  eq(verified.status,302,'successful second factor');eq(verified.headers.get('location'),'/','completed login');
  const header=verified.headers.getSetCookie().find(c=>c.startsWith('crm_session=')&&!c.includes('Max-Age=0'));
  ok(header?.includes('HttpOnly')&&header.includes('SameSite=Lax')&&header.includes('Max-Age=43200'),'cookie protections');
  return header.split(';')[0];
}
(async()=>{
 const admin=await login('admin@audit.example','Audit-Only-Password-2026');
 const coordMail=marker+'coord@example.com',techMail=marker+'tech@example.com',password='Audit-only-password-1234';
 let fixture;
 const linkedTechs=JSON.parse(db(`const ids=[];for(let i=0;i<2;i++){const t=await m.technicianModel.create({Nombre_tecnico:${JSON.stringify(marker)}+i,Numero_tecnico:"5512345678",Estatus_tecnico:"Activo"});ids.push(t.ID_Tecnico)}console.log(JSON.stringify(ids));`));
 try {
  for(const route of ['/','/tickets','/inventario','/usuarios']) eq((await request(route)).status,302,'anonymous HTML redirect');
  eq((await request('/tickets',{headers:{Accept:'application/json'}})).status,401,'anonymous API denial');
  eq((await request('/api/email/test',{method:'POST',body:{}})).status,401,'anonymous email blocked');
  for(const route of ['/health','/login','/bootstrap/css/bootstrap.min.css','/leaflet/leaflet.js','/assets/pages/ticket-list.js']) eq((await request(route)).status,200,'public asset/health');
  eq((await request('/login',{method:'POST',body:{correo:'bad',password:'x'}})).status,400,'bad login input');
  eq((await request('/login',{method:'POST',body:{correo:'missing@example.com',password}})).status,401,'unknown account');
  eq((await request('/login',{method:'POST',body:{correo:'admin@audit.example',password:'bad'}})).status,401,'wrong password');
  eq((await request('/login',{method:'POST',body:{correo:'admin@audit.example',password},headers:{Origin:'https://hostile.example'}})).status,403,'login origin check');
  for(const [correo,rol] of [[coordMail,'coordinador'],[techMail,'tecnico']]) eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:{correo,rol,password,confirmPassword:password,id_tecnico:rol==='tecnico'?String(linkedTechs[0]):''}})).status,302,'create account');
  const ids=JSON.parse(db(`const [users]=await m.database.query('SELECT id,correo,password_hash FROM usuarios WHERE correo IN (?,?)',{replacements:[${JSON.stringify(coordMail)},${JSON.stringify(techMail)}]});console.log(JSON.stringify(users));`));
  for(const u of ids) ok(u.password_hash.startsWith('scrypt:')&&!u.password_hash.includes(password),'password hashing');
  const coordId=ids.find(u=>u.correo===coordMail).id,techId=ids.find(u=>u.correo===techMail).id;
  let coord=await login(coordMail,password),tech=await login(techMail,password);
  eq((await request('/api/email/test',{cookie:coord,method:'POST',body:{to:'first@example.test,second@example.test'}})).status,400,'test mail rejects multiple recipients');
  eq((await request('/api/email/test',{cookie:coord,method:'POST',body:{to:'single@example.test'}})).status,200,'coordinator can send one test message');
  eq((await request('/api/email/test',{cookie:coord,method:'POST',body:{to:'single@example.test'}})).status,200,'test email within account quota');
  const mailLimit=await request('/api/email/test',{cookie:coord,method:'POST',body:{to:'single@example.test'}});
  eq(mailLimit.status,429,'test mail rate limit');ok(mailLimit.headers.get('retry-after'),'test mail retry after');
  const token=coord.split('=')[1],hash=createHash('sha256').update(token).digest('hex');
  const stored=JSON.parse(db(`const [r]=await m.database.query('SELECT token_hash,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),expira_en) AS lifetime FROM sesiones_usuario WHERE token_hash=?',{replacements:[${JSON.stringify(hash)}]});console.log(JSON.stringify(r[0]));`));eq(stored.token_hash,hash,'session stored hashed');ok(stored.lifetime>43000&&stored.lifetime<=43200,'12 hour lifetime');
  for(const route of ['/usuarios','/Usuarios','/USUARIOS/','/%75suarios','/usuarios/crear']) eq((await request(route,{cookie:coord})).status,403,'coordinator cannot administer any casing');
  for(const route of ['/inventario','/directorio','/asignaciones','/catalogos','/tickets/nuevo']) eq((await request(route,{cookie:tech})).status,403,'technician forbidden page');
  for(const route of ['/add_ticket','/tickets/reabrir/1','/tickets/asignar_tecnico','/tickets/actualizar_comentarios','/tickets/actualizar_maps','/tickets/1/subir-fotos','/api/email/test']) eq((await request(route,{cookie:tech,method:'POST',body:{}})).status,403,'technician forbidden mutation');
  for(const route of ['/','/tickets','/estado_tickets','/leaflet/leaflet.js']) eq((await request(route,{cookie:tech})).status,200,'technician read access');
  let html=await (await request('/tickets',{cookie:tech})).text();ok(!html.includes('id="new-ticket"')&&!html.includes('id="ticket-create-panel"'),'no creation controls for technician');
  html=await (await request('/',{cookie:tech})).text();ok(!html.includes('href="/inventario"')&&!html.includes('id="crmSetupAssistant"'),'technician dashboard/menu aligned');
  eq((await request('/tickets?setup=ticket',{cookie:tech})).status,403,'legacy wizard form blocked');
  const location=await csrfFetch(base+'/tickets/resolver_ubicacion',{method:'POST',headers:{Cookie:tech,'Content-Type':'application/json'},body:JSON.stringify({url:'https://www.google.com/maps?q=19.4,-99.1'})});eq(location.status,200,'technician read-only map conversion');
  const invalid={correo:marker+'invalid@example.com',rol:'superadmin',password,confirmPassword:password};
  eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:invalid})).status,400,'invalid role rejected');
  eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:{...invalid,rol:'tecnico',password:'short',confirmPassword:'short'}})).status,400,'password minimum');
  eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:{...invalid,rol:'tecnico',confirmPassword:'different',id_tecnico:String(linkedTechs[1])}})).status,400,'confirmation required');
  eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:{correo:coordMail,rol:'tecnico',password,confirmPassword:password,id_tecnico:String(linkedTechs[1])}})).status,409,'duplicate account');
  const adminId=Number(db("const [r]=await m.database.query(\"SELECT id FROM usuarios WHERE correo='admin@audit.example'\");console.log(r[0].id);"));
  for(const action of ['editar','eliminar']) eq((await request(`/usuarios/${adminId}/${action}`,{cookie:admin,method:'POST',body:{correo:'changed@example.com',rol:'tecnico',password:'',confirmPassword:'',id_tecnico:String(linkedTechs[1])}})).status,409,'last administrator protected');
  eq((await request('/usuarios/0/eliminar',{cookie:admin,method:'POST',body:{}})).status,400,'invalid user id');
  eq((await request('/usuarios/crear',{cookie:admin,method:'POST',body:invalid,headers:{Origin:'http://evil.example'}})).status,403,'cross origin mutation blocked');
  eq((await request('/logout',{cookie:admin,method:'POST',body:{},headers:{Origin:'null'}})).status,403,'malformed origin blocked');
  fixture=JSON.parse(db(`const c=await m.clientModel.create({Nombre_empresa:${JSON.stringify(marker)},Encargado:'QA',Numero:'5512345678'});const um=await m.unitCatalogModel.create({Marca_unidad:${JSON.stringify(marker)},Modelo_Unidad:'QA'});const em=await m.equipmentCatalogModel.create({Marca_equipo:${JSON.stringify(marker)},Modelo_equipo:'QA'});const e=await m.equipmentModel.create({ID_equipo_modelo:em.ID_equipo_modelo,Estatus_equipo:'Asignado'});const t=await m.ticketModel.create({ID_cliente:c.ID_cliente,ID_tecnico:${linkedTechs[0]},Tipo_servicio:'Instalacion',Estatus_servicio:'En seguimiento',Numero_unidades:1,Fecha_servicio:new Date(),Link_maps:'https://www.google.com/maps?q=19.4,-99.1'});await m.unitModel.create({ID_ticket:t.ID_ticket,ID_Unidad_modelo:um.ID_Unidad_modelo,ID_equipo:e.ID_equipo});const incomplete=await m.ticketModel.create({ID_cliente:c.ID_cliente,ID_tecnico:${linkedTechs[0]},Tipo_servicio:'Instalacion',Estatus_servicio:'En seguimiento',Numero_unidades:1});console.log(JSON.stringify({client:c.ID_cliente,unitModel:um.ID_Unidad_modelo,equipmentModel:em.ID_equipo_modelo,equipment:e.ID_equipo,ticket:t.ID_ticket,incomplete:incomplete.ID_ticket}));`));
  html=await (await request('/detalle_ticket/'+fixture.ticket,{cookie:tech})).text();ok(!html.includes('id="ticket-assignment-context"')&&!html.includes('id="formSubida"')&&!html.includes('id="modalComentarios"')&&html.includes('data-ticket-action="complete"'),'technician detail read/close only');
  eq((await request('/tickets/finalizar/'+fixture.incomplete,{cookie:tech,method:'POST',body:{}})).status,409,'incomplete closure still rejected');
  eq((await request('/tickets/finalizar/'+fixture.ticket,{cookie:tech,method:'POST',body:{}})).status,302,'technician can close prepared ticket');
  eq(db(`const t=await m.ticketModel.findByPk(${fixture.ticket}),e=await m.equipmentModel.findByPk(${fixture.equipment});console.log(t.Estatus_servicio+'|'+e.Estatus_equipo);`),'Finalizado|Instalado','closure keeps equipment lifecycle');
  const nextPassword='Updated-audit-password-1234';
  eq((await request(`/usuarios/${coordId}/editar`,{cookie:admin,method:'POST',body:{correo:coordMail,rol:'tecnico',password:nextPassword,confirmPassword:nextPassword,id_tecnico:String(linkedTechs[1])}})).status,302,'account edit');
  eq((await request('/tickets',{cookie:coord,headers:{Accept:'application/json'}})).status,401,'edit revokes old session');
  eq((await request('/login',{method:'POST',body:{correo:coordMail,password}})).status,401,'old password invalid');
  coord=await login(coordMail,nextPassword);eq((await request('/inventario',{cookie:coord})).status,403,'new role enforced');
  const oldTech=tech;tech=await login(techMail,password,tech);ok(oldTech!==tech,'session rotated');eq((await request('/tickets',{cookie:oldTech,headers:{Accept:'application/json'}})).status,401,'old session invalid after rotation');
  const expiredHash=createHash('sha256').update(tech.split('=')[1]).digest('hex');db(`await m.database.query('UPDATE sesiones_usuario SET expira_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?',{replacements:[${JSON.stringify(expiredHash)}]});`);
  eq((await request('/tickets',{cookie:tech,headers:{Accept:'application/json'}})).status,401,'expired session rejected');tech=await login(techMail,password);
  eq((await request(`/usuarios/${techId}/eliminar`,{cookie:admin,method:'POST',body:{}})).status,302,'delete user');eq((await request('/tickets',{cookie:tech,headers:{Accept:'application/json'}})).status,401,'delete cascades session revocation');
  eq((await request('/logout',{cookie:coord,method:'POST',body:{}})).status,302,'logout');eq((await request('/tickets',{cookie:coord,headers:{Accept:'application/json'}})).status,401,'logged out token rejected');
  // Initialization is idempotent and preserves administrator roles regardless of their email.
  db(`const a=require('./dist/auth');await a.initializeAuthentication();await a.initializeAuthentication();const [r]=await m.database.query(\"SELECT COUNT(*) AS n FROM usuarios WHERE correo='admin@audit.example' AND rol='admin'\");if(Number(r[0].n)!==1)throw new Error('admin changed');`);checks++;
  const limited=await request('/login',{method:'POST',body:{correo:'missing@example.com',password}});eq(limited.status,429,'IP quota includes successful logins');ok(limited.headers.get('retry-after'),'retry after');
  console.log(`PASS ${checks} authentication, session, role, CRUD and lifecycle checks`);
 } finally {
  db(`await m.database.query('DELETE FROM usuarios WHERE correo LIKE ?',{replacements:[${JSON.stringify(marker+'%')}]});${fixture?`await m.unitModel.destroy({where:{ID_ticket:${fixture.ticket}}});await m.ticketModel.destroy({where:{ID_cliente:${fixture.client}}});await m.equipmentModel.destroy({where:{ID_equipo:${fixture.equipment}}});await m.equipmentCatalogModel.destroy({where:{ID_equipo_modelo:${fixture.equipmentModel}}});await m.unitCatalogModel.destroy({where:{ID_Unidad_modelo:${fixture.unitModel}}});await m.clientModel.destroy({where:{ID_cliente:${fixture.client}}});`:''}`);
  db(`await m.technicianModel.destroy({where:{ID_Tecnico:[${linkedTechs.join(',')}]}});`);
  await request('/logout',{cookie:admin,method:'POST',body:{}});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
