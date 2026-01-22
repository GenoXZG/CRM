const Unidad_stock = require('../models/Unidad_stock');
const Sequelize = require('../config/db')


const listarUnidadStock = async ()=>{
    try {
        const unidades = await Unidad_stock.findAll()
        return unidades;
    } catch (error) {
        console.log("Error (service)", error);
    }
}


const agregarUnidadStock = (datosUnidad) => {

    const {Marca_unidad, Modelo_Unidad} = datosUnidad;

    try{
        Unidad_stock.create({
            Marca_unidad: Marca_unidad,
            Modelo_Unidad : Modelo_Unidad
        });
        console.log(Marca_unidad, Modelo_Unidad);
    }
    catch{
        console.log('error (service)');
    }
};



const editarUnidadStock = async(datosUnidad)=>{
    try{
        const {ID_Unidad_modelo, Marca_unidad, Modelo_Unidad} = datosUnidad;
        await Unidad_stock.update({
            Marca_unidad,
            Modelo_Unidad
        },
        {
            where : {ID_Unidad_modelo}
        });
    }
    catch (error){
        console.log("Error al editar la unidad (service)" ), error;
    }
}

const eliminarUnidadStock = async(datosUnidad )=>{

    try{
        const {ID_Unidad_modelo} = datosUnidad;
        await Unidad_stock.destroy({
            where : {ID_Unidad_modelo}
        });
    }
    catch (error){
        console.log('Error al eliminar la unidad', error);
    }
}

const marcas = async ()=>{
    try{
        const marcaslistado = await Unidad_stock.findAll({
        attributes: [
            [Sequelize.fn('DISTINCT', Sequelize.col('Marca_unidad')), 'Marca_unidad']
        ],
        order: [['Marca_unidad', 'ASC']]
        });
        return marcaslistado;
    }
    catch{
        console.log("error (service)");
    }
    
}


const modeloMarca = async (datoMarca)=>{
    try{
        const { marca } = datoMarca;
        const modelos = await Unidad_stock.findAll({
            attributes: ['ID_Unidad_modelo', 'Modelo_Unidad'],
            where: { Marca_unidad: marca }, 
            order: [['Modelo_Unidad', 'ASC']]
        });
        return modelos; 
    }
    catch (error) {
        console.error("Error al obtener modelos: (service) ", error);
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