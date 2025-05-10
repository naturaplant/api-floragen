// src/features/plants/plantService.ts

import { eq } from 'drizzle-orm';
import { D1Database } from '@cloudflare/workers-types';
import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';

import { plantsTable, NewPlant, Plant } from '../../db/schema';
import * as schemaImport from '../../db/schema'; // Para passar o schema completo ao Drizzle

import { generatePlantCultivationContent } from './generateContent';
import { generateBriefDescription } from './briefDescription';

import { Bindings } from '../../types';

const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

export class PlantService {
    private db: DrizzleD1Database<typeof schemaImport>;

    constructor(d1Database: D1Database) {
        this.db = drizzle(d1Database, { schema: schemaImport });
    }

    async listPlants(): Promise<Plant[]> {
        customConsole.log("[PlantService.listPlants] Buscando todas as plantas.");
        return this.db.select().from(plantsTable).all();
    }

    async getPlantById(id: number): Promise<Plant | undefined> {
        customConsole.log(`[PlantService.getPlantById] Buscando planta com ID: ${id}`);
        return this.db.select().from(plantsTable).where(eq(plantsTable.id, id)).get();
    }

/*    async getPlantBySlugAndLanguage(slug: string, language: string): Promise<Plant | undefined> {
        customConsole.log(`[PlantService.getPlantBySlugAndLanguage] Buscando por slug: "${slug}", idioma: "${language}"`);
        return this.db.select().from(plantsTable)
            .where(eq(plantsTable.slug, slug))
            .where(eq(plantsTable.language, language))
            .get();
    }*/

    async getPlantByNameAndLanguage(name: string): Promise<Plant | undefined> {
        const trimmedName = name.trim();

        return this.db.select().from(plantsTable)
            .where(eq(plantsTable.name, trimmedName))
            .get();
    }

    async createPlant(env: Bindings, plantData: NewPlant): Promise<Plant> {
        customConsole.log(`[PlantService.createPlant] Tentando criar planta: ${plantData.name} (${plantData.language})`);

        let finalContent: string | null = null;
        if (plantData.content !== undefined) {
            finalContent = plantData.content;
            customConsole.log(`[PlantService.createPlant] Usando 'content' fornecido para "${plantData.name}".`);
        } else if (env.GEMINI_API_KEY) {
            customConsole.log(`[PlantService.createPlant] 'content' não fornecido para "${plantData.name}". Tentando geração por IA...`);
            try {
                const generatedContent = await generatePlantCultivationContent(
                    env,
                    plantData.name,
                    plantData.title || null,
                    plantData.language
                );
                if (generatedContent) {
                    finalContent = generatedContent;
                    customConsole.log(`[PlantService.createPlant] 'content' gerado por IA com sucesso para "${plantData.name}".`);
                } else {
                    customConsole.warn(`[PlantService.createPlant] Geração por IA de 'content' retornou nulo/vazio para "${plantData.name}". 'content' será nulo.`);
                }
            } catch (genError: any) {
                customConsole.error(`[PlantService.createPlant] Erro durante geração por IA de 'content' para "${plantData.name}": ${genError.message}. 'content' será nulo.`);
            }
        } else {
            customConsole.warn(`[PlantService.createPlant] 'content' não fornecido e GEMINI_API_KEY indisponível. 'content' será nulo para "${plantData.name}".`);
        }

        let finalBriefDescription: string | null = null;
        if (plantData.brief_description !== undefined) {
            finalBriefDescription = plantData.brief_description;
            customConsole.log(`[PlantService.createPlant] Usando 'brief_description' fornecida para "${plantData.name}".`);
        } else if (finalContent && env.GEMINI_API_KEY) {
            customConsole.log(`[PlantService.createPlant] 'brief_description' não fornecida para "${plantData.name}". Tentando geração por IA com base no conteúdo principal...`);
            try {
                const generatedBriefDesc = await generateBriefDescription(
                    env,
                    plantData.name,
                    finalContent,
                    plantData.language
                );
                if (generatedBriefDesc) {
                    finalBriefDescription = generatedBriefDesc;
                    customConsole.log(`[PlantService.createPlant] 'brief_description' gerada por IA com sucesso para "${plantData.name}".`);
                } else {
                    customConsole.warn(`[PlantService.createPlant] Geração por IA de 'brief_description' retornou nulo/vazio para "${plantData.name}". 'brief_description' será nula.`);
                }
            } catch (briefDescError: any) {
                customConsole.error(`[PlantService.createPlant] Erro durante geração por IA de 'brief_description' para "${plantData.name}": ${briefDescError.message}. 'brief_description' será nula.`);
            }
        } else if (plantData.brief_description === undefined) {
            customConsole.warn(`[PlantService.createPlant] 'brief_description' não fornecida e pré-requisitos para geração por IA não atendidos (sem conteúdo principal ou sem chave API). 'brief_description' será nula para "${plantData.name}".`);
        }

        const valuesToInsert: NewPlant = {
            name: plantData.name,
            language: plantData.language,
            slug: plantData.slug!, // O handler (plantValidate) deve garantir que slug está presente e é válido
            title: plantData.title || null,
            scientific_name: plantData.scientific_name || null, // O handler (plantValidate) pode ter gerado este
            brief_description: finalBriefDescription,
            content: finalContent,
        };

        customConsole.log(`[PlantService.createPlant] Inserindo planta com valores: { nome: "${valuesToInsert.name}", slug: "${valuesToInsert.slug}", idioma: "${valuesToInsert.language}" }`);

        try {
            const result = await this.db.insert(plantsTable)
                .values(valuesToInsert)
                .returning()
                .get();

            if (!result) {
                customConsole.error(`[PlantService.createPlant] Falha ao criar planta "${plantData.name}" ou registro não foi retornado após inserção.`);
                throw new Error(`Falha ao criar planta "${plantData.name}" ou obter retorno do BD após inserção.`);
            }
            customConsole.log(`[PlantService.createPlant] Planta "${plantData.name}" criada com sucesso com ID: ${result.id}.`);
            return result as Plant;
        } catch (e: any) {
            customConsole.error(`[PlantService.createPlant] Erro de BD ao inserir planta "${plantData.name}":`, e.message);
            if (e.message?.includes("UNIQUE constraint failed")) {
                customConsole.warn(`[PlantService.createPlant] Violação de constraint UNIQUE para slug "${valuesToInsert.slug}", idioma "${valuesToInsert.language}".`);
                throw new Error(`Planta com slug '${valuesToInsert.slug}' e idioma '${valuesToInsert.language}' já existe.`);
            }
            throw new Error(`Falha ao criar planta no BD: ${e.message}`);
        }
    }

    async updatePlant(id: number, plantUpdateData: Partial<Omit<NewPlant, 'id' | 'slug' | 'language'>>): Promise<Plant | undefined> {
        customConsole.log(`[PlantService.updatePlant] Tentando atualizar planta ID: ${id}`);
        const { ...updateData } = plantUpdateData;

        if (Object.keys(updateData).length === 0) {
            customConsole.warn("[PlantService.updatePlant] Nenhum dado fornecido para atualização. Retornando planta existente.");
            return this.getPlantById(id);
        }

        try {
            const result = await this.db.update(plantsTable)
                .set(updateData)
                .where(eq(plantsTable.id, id))
                .returning()
                .get();
            if (result) {
                customConsole.log(`[PlantService.updatePlant] Planta ID ${id} atualizada com sucesso.`);
            } else {
                customConsole.warn(`[PlantService.updatePlant] Planta ID ${id} não encontrada para atualização.`);
            }
            return result;
        } catch (e: any) {
            customConsole.error(`[PlantService.updatePlant] Erro de BD ao atualizar planta ID ${id}:`, e.message);
            throw new Error(`Falha ao atualizar planta: ${e.message}`);
        }
    }

    async deletePlant(id: number): Promise<Plant | undefined> {
        customConsole.log(`[PlantService.deletePlant] Tentando deletar planta ID: ${id}`);
        try {
            const result = await this.db.delete(plantsTable)
                .where(eq(plantsTable.id, id))
                .returning()
                .get();
            if (result) {
                customConsole.log(`Planta ID ${id} deletada com sucesso.`);
            } else {
                customConsole.warn(`[PlantService.deletePlant] Planta ID ${id} não encontrada para deleção.`);
            }
            return result;
        } catch (e: any) {
            customConsole.error(`[PlantService.deletePlant] Erro de BD ao deletar planta ID ${id}:`, e.message);
            throw new Error(`Falha ao deletar planta: ${e.message}`);
        }
    }
}