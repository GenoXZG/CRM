const Cliente = require('../models/Cliente');

const listarClientes = async ()=>{
    const clientes = await Cliente.findAll();
    return clientes;
}



const agregarCliente = async (datosCliente) =>{
    try{    
      const nuevoCliente = await Cliente.create(datosCliente);  
      console.log(nuevoCliente);
    }
    catch (err) {
        console.log(err);
    }
};

const editarCliente = async (datosCliente) => {
  
  try {
    const [filasAfectadas] = await Cliente.update(
      {
        Nombre_empresa: datosCliente.Nombre_empresa,
        Encargado: datosCliente.Encargado,
        Numero: datosCliente.Numero
      },
      {
        where: { ID_cliente: datosCliente.ID_cliente}
      }
    );
    if (filasAfectadas === 0) {
      console.log("Cliente no encontrado o sin cambios");
    }
  } catch (error) {
    console.error("Error al editar cliente:", error);
  }
};

const eliminarCliente = async (ID_cliente)=>{

    try{
        await Cliente.destroy({
            where: {ID_cliente}
        })
    }
    catch(err){
        console.log('error al elmiminar el cliente:', err);
    }
}


module.exports = {
    listarClientes,
    agregarCliente,
    editarCliente,
    eliminarCliente
};