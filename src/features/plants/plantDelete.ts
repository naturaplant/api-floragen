import { Context } from 'hono';
import { PlantService } from './plantService';

export const deletePlantHandler = async (c: Context) => {
    const plantService = new PlantService(c.env.DB);
    const id = parseInt(c.req.param('id'), 10);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid plant ID' }, 400);
    }

    try {
        const existingPlant = await plantService.getPlantById(id);
        if (!existingPlant) {
            return c.json({ error: 'Plant not found' }, 404);
        }

        const deletedPlant = await plantService.deletePlant(id);
        return c.json(deletedPlant);
    } catch (error) {
        console.error(`Error deleting plant with id ${id}:`, error);
        return c.json({ error: 'Failed to delete plant' }, 500);
    }
};