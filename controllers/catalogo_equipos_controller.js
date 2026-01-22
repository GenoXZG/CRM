
const catalogoEquipoService = require('../services/catalogoEquipoService');

const agregarEquipoStock = async (req, res) =>{
try{
    await catalogoEquipoService.agregarEquipoStock(req.body);
    res.redirect('/equipos');
}
catch{
    console.log('Error en la insercion (controller)');
}
};

const listarEquiposStock = async (req,res) =>{
    try{
        const equipos_stock = await catalogoEquipoService.listarEquiposStock(); 
        res.render('equipos_catalogo', {equipos_stock})
    }
    catch(err){
        console.log("error (controller)");
    }
}


const editarEquipoStock = async (req,res) =>{
    try{
        await catalogoEquipoService.editarEquipoStock(req.body);
        res.redirect('/equipos');
    }
    catch{
        console.log('Error al editar el equipo (controller)');
    }
}

const eliminarEquipoStock = async (req,res)=>{
    try{
        await catalogoEquipoService.eliminarEquipoStock(req.body);
        res.redirect('/equipos');
    }
    catch{
        console.log('Error al eliminar (controller)');
    }
}


module.exports = {
    agregarEquipoStock,
    listarEquiposStock,
    editarEquipoStock,
    eliminarEquipoStock
};
    
