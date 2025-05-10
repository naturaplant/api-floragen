import { Context } from 'hono';
import { PlantService } from './plantService';
import { Partial } from 'drizzle-orm';
import { NewPlant } from '../../db/schema';

export const updatePlantHandler = async (c: Context) => {
    const plantService = new PlantService(c.env.DB);
    const id = parseInt(c.req.param('id'), 10);
    const updatedPlantData: Partial<NewPlant> = await c.req.json();

    if (isNaN(id)) {
        return c.json({ error: 'Invalid plant ID' }, 400);
    }

    try {
        const existingPlant = await plantService.getPlantById(id);
        if (!existingPlant) {
            return c.json({ error: 'Plant not found' }, 404);
        }

        const updatedPlant = await plantService.updatePlant(id, updatedPlantData);
        return c.json(updatedPlant);
    } catch (error) {
        console.error(`Error updating plant with id ${id}:`, error);
        return c.json({ error: 'Failed to update plant' }, 500);
    }
};