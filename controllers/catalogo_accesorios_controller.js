const catalogoAccesorioService = require("../services/catalogoAccesorioService");



const listarAccesoriosStock = async (req, res)=>{
    try{
        const accesorios_stock = await catalogoAccesorioService.listarAccesoriosStock(req.body);
        res.render('accesorios_catalogo', {accesorios_stock})
    }
    catch (error){
        console.log("error (controller): ", error);
    }
}

const agregarAccesorioStock = async (req, res) =>{
   
    try{
        await catalogoAccesorioService.agregarAccesorioStock(req.body);
        res.redirect('/accesorios');
    }
    catch (error){
       console.log("error (controller)", error);
    }
};

const editarAccesorioStock = async(req, res)=>{

    
    try{
        await catalogoAccesorioService.editarAccesorioStock(req.body);
        res.redirect('/accesorios');
    }
    catch{
        console.log('Error al editar el accesorio (controller)');
    }

}

const eliminarAccesorioStock = async(req,res)=>{

    
    try{
        await catalogoAccesorioService.eliminarAccesorioStock(req.body);
        res.redirect('/accesorios');
    }
    catch{
        console.log("Error al eliminar (controller)");
    }
}

module.exports = {
    agregarAccesorioStock,
    listarAccesoriosStock,
    editarAccesorioStock,
    eliminarAccesorioStock
};