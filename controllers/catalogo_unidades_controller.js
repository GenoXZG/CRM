const catalogoUnidadService = require('../services/catalogoUnidadService');

const agregarUnidadStock = async (req,res) => {

    try{
        await catalogoUnidadService.agregarUnidadStock(req.body)
        res.redirect('/unidades');
    }
    catch{
        console.log('error (controller)');
    }
};


const listarUnidadStock = async (req,res)=>{   
    try {
        const unidades = await catalogoUnidadService.listarUnidadStock();
        res.render('unidades_catalogo', {unidades});
    } catch (error) {
        console.log("error (controller)", error);
    }
}

const editarUnidadStock = async(req, res)=>{
    try{
        await catalogoUnidadService.editarUnidadStock();
        res.redirect('/unidades');
    }
    catch{
        console.log("Error al editar la unidad (controller)");
    }
}

const eliminarUnidadStock = async(req,res)=>{

    try{
        await catalogoUnidadService.eliminarUnidadStock(req.body);
        res.redirect('/unidades');
    }
    catch(error){
        console.log('Error al eliminar la unidad (controller)', error);
    }

}

const marcas = async (req,res)=>{
    try{
        const marcaslistado = await catalogoUnidadService.marcas();
        res.json(marcaslistado);
    }
    catch{
        console.log("error (controller)");
    }
}

const modeloMarca = async (req, res)=>{
    try{
        
        const modelos = await catalogoUnidadService.modeloMarca(req.query);
        res.json(modelos); 
    }
    catch (error) {
        console.error("Error al obtener modelos (controller):", error);
        res.status(500).json({ error: "Error al obtener modelos" });
    }
}

module.exports = {
    agregarUnidadStock,
    listarUnidadStock,
    editarUnidadStock,
    eliminarUnidadStock,
    marcas,
    modeloMarca
};