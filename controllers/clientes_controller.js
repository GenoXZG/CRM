
const clienteService = require('../services/clienteService');

const listarClientes = async (req, res) => {
  try{
    const clientes = await clienteService.listarClientes();
    res.render('clientes', { clientes });
  }
  catch{
    res.status(500).render('error', { mensaje: 'Error al cargar clientes' });
  }
}



const agregarCliente = (req,res) =>{

    try{
    clienteService.agregarCliente(req.body);
    res.redirect('/clientes');
    }
    catch{
    res.status(400).render('clientes', { error: error.message });
    }
};

const editarCliente = async (req, res) => {
  try {
    await clienteService.editarCliente(req.body);
    res.redirect("/clientes");
  } catch (error) {
    console.error("Error al editar cliente:", error);
    res.status(500).send("Error del servidor");
  }
};


const eliminarCliente = async (req, res)=>{

    const {ID_cliente} = req.body;
    try{
        await clienteService.eliminarCliente(ID_cliente);
        res.redirect("/clientes");
    }
    catch{
        console.log('error al eliminar el cliente')
    }
}

module.exports = {
    listarClientes,
    agregarCliente,
    editarCliente,
    eliminarCliente
}; 