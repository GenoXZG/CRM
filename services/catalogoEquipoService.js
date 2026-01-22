const Equipo_stock = require('../models/Equipo_stock');

const listarEquiposStock = async() =>{
    try{
        const equiposStock = Equipo_stock.findAll()
        return equiposStock;
    }
    catch(err){
        console.log("error (service): ", err);
    }
}



const agregarEquipoStock = async (datosEquipo) =>{

    const {Marca_equipo , Modelo_equipo } = datosEquipo;
    try{
     await Equipo_stock.create({
        Marca_equipo : Marca_equipo,
        Modelo_equipo : Modelo_equipo
    });
    }   
    catch{
        console.log('Error en la insercion (service)');
    }
};




const editarEquipoStock = async (datosEquipo) =>{
    const {ID_equipo_modelo, Marca_equipo, Modelo_equipo} = datosEquipo;
    try{
       await Equipo_stock.update({
            Marca_equipo,
            Modelo_equipo
        },
        {
            where: {ID_equipo_modelo}
        });
    }
    catch{
        console.log('Error al editar el equipo (service)');
    }
}


const eliminarEquipoStock = async (datosEquipo)=>{
try{
    const {ID_equipo_modelo} = datosEquipo;
     await Equipo_stock.destroy({
        where : {ID_equipo_modelo}
    })
}
catch{
    console.log('Error al eliminar (service)');
}
}

module.exports = {
    listarEquiposStock,
    agregarEquipoStock,
    editarEquipoStock,
    eliminarEquipoStock

};