require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const path = require('path');

const app = express();
const port = 3030;

app.use(express.json()); 
app.use(bodyparser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

const routes = require('./routes/index');
app.use('/', routes);  

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap/dist'));

app.use(express.static('public'));

const sequelize = require('./config/db');

sequelize.authenticate()
  .then(() => console.log('Conectado a la base de datos MySQL.'))
  .catch(err => console.error('Error de conexión:', err));

  
app.listen(port,()=>{
     console.log(`Server en linea:${port}`);
}); 
