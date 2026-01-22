const Tecnico = require('../models/Tecnicos');

const listarTecnicos = async () => {
  try{
    const tecnicos = await Tecnico.findAll();
    return tecnicos;
  }    
  catch (error){
    console.log("Error al listar los tecnicos:", error);
  }
};


const agregarTecnico = (datosTecnico) => {
 const {Nombre_tecnico, Estatus_tecnico, Numero_tecnico} = datosTecnico;
 try{
    Tecnico.create({
        Nombre_tecnico : Nombre_tecnico,
        Estatus_tecnico : Estatus_tecnico,
        Numero_tecnico : Numero_tecnico
    });
    console.log(Nombre_tecnico, Estatus_tecnico, Numero_tecnico);
 }
 catch(err){
    console.log(err);
 }
};

const editarTecnico = async (datosTecnico) => {
  const { ID_Tecnico, Nombre_tecnico, Numero_tecnico, Estatus_tecnico } = datosTecnico;

  try {
    await Tecnico.update(
      {
        Nombre_tecnico,
        Numero_tecnico,
        Estatus_tecnico
      },
      {
        where: { ID_Tecnico }
      }
    );
    
  } catch (error) {
    console.error('Error al editar técnico:', error);
    
  }
};

const eliminarTecnico = async (datosTecnico) => {
  const { ID_Tecnico } = datosTecnico;
  try {
    await Tecnico.destroy({ where: { ID_Tecnico } });
  } catch (error) {
    console.error('Error al eliminar técnico:', error);
  }
};



module.exports = {
    listarTecnicos,
    agregarTecnico,
    editarTecnico,
    eliminarTecnico
};
