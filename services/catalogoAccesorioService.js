const Accesorio_stock = require('../models/Accesorio_stock');


const listarAccesoriosStock = async (datosAccesorio)=>{
    try {
        const accesoriosStock = await Accesorio_stock.findAll()
        return(accesoriosStock);
    } catch (error) {
        console.log("error (service): ", error);
    }
}

const agregarAccesorioStock = (datosAccesorio) =>{
    const {Nombre_accesorio} = datosAccesorio;
    try{
        Accesorio_stock.create({
            Nombre_accesorio : Nombre_accesorio
        }
        );
    }
    catch(error){
       console.log("error (service): ", error);
    }
};


const editarAccesorioStock = async(datosAccesorio)=>{

    const{ID_accesorio_modelo, Nombre_accesorio} = datosAccesorio;
    try{
        await Accesorio_stock.update({
            Nombre_accesorio
        },
        {
            where : {ID_accesorio_modelo}
        });
    }
    catch{
        console.log('Error al editar el accesorio (service)');
    }
}


const eliminarAccesorioStock = async(datosAccesorio)=>{

    const {ID_accesorio_modelo} = datosAccesorio;
    try{
        await Accesorio_stock.destroy({
            where : {ID_accesorio_modelo}
        })
    }
    catch(error){
        console.log("Error al eliminar (service)", error);
    }
}

module.exports = {

    listarAccesoriosStock,
    agregarAccesorioStock,
    editarAccesorioStock,
    eliminarAccesorioStock

};