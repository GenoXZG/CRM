const tecnicoService = require("../services/tecnicoService");

const agregarTecnico = async (req, res) => {
 const {Nombre_tecnico, Estatus_tecnico, Numero_tecnico} = req.body;
 try{
    await tecnicoService.agregarTecnico(req.body);
    res.redirect('/tecnicos');
 }
 catch(err){
    console.log(err);
 }
};



const listarTecnicos =  async (req, res) => {
  try{
    const tecnicos = await tecnicoService.listarTecnicos();
    res.render('tecnicos', { tecnicos });
  }
  catch (error){
    res.status(500).render('error', { mensaje: 'Error al cargar tecnicos'});
  }
};




const editarTecnico = async (req, res) => {
  const { ID_Tecnico, Nombre_tecnico, Numero_tecnico, Estatus_tecnico } = req.body;

  try {
    await tecnicoService.editarTecnico(req.body);
    res.redirect('/tecnicos');
  } catch (error) {
    console.error('Error al editar técnico:', error);
    res.status(500).send('Error del servidor');
  }
};

const eliminarTecnico = async (req, res) => {
 
  try {
    await tecnicoService.eliminarTecnico(req.body);
    res.redirect('/tecnicos');
  } catch (error) {
    console.error('Error al eliminar técnico:', error);
    res.status(500).send('Error del servidor');
  }
};

module.exports = {
    agregarTecnico,
    listarTecnicos,
    editarTecnico,
    eliminarTecnico
}; 