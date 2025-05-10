import { Context } from 'hono';
import { PlantService } from './plantService';

export const listPlantsHandler = async (c: Context) => {
    const plantService = new PlantService(c.env.DB);
    try {
        const plants = await plantService.listPlants();
        return c.json(plants);
    } catch (error) {
        console.error('Error listing plants:', error);
        return c.json({ error: 'Failed to retrieve plants' }, 500);
    }
};

export const getPlantByIdHandler = async (c: Context) => {
    const plantService = new PlantService(c.env.DB);
    const id = parseInt(c.req.param('id'), 10);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid plant ID' }, 400);
    }

    try {
        const plant = await plantService.getPlantById(id);
        if (!plant) {
            return c.json({ error: 'Plant not found' }, 404);
        }
        return c.json(plant);
    } catch (error) {
        console.error(`Error getting plant with id ${id}:`, error);
        return c.json({ error: 'Failed to retrieve plant' }, 500);
    }
};