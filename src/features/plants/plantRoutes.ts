import { Hono } from 'hono';
import { listPlantsHandler, getPlantByIdHandler } from './plantList';
import { createPlantHandler } from './plantCreate';
import { updatePlantHandler } from './plantUpdate';
import { deletePlantHandler } from './plantDelete';
import { Bindings } from '../../types'; // <--- ALTERADO para usar nosso tipo Bindings

const plants = new Hono<{ Bindings: Bindings }>(); // <--- ALTERADO para usar nosso tipo Bindings

plants.get('/', listPlantsHandler);
plants.get('/:id{[0-9]+}', getPlantByIdHandler);
plants.post('/', createPlantHandler);
plants.put('/:id{[0-9]+}', updatePlantHandler);
plants.delete('/:id{[0-9]+}', deletePlantHandler);

export default plants;