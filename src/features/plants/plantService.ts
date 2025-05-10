import { eq } from 'drizzle-orm';
import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { plantsTable, NewPlant, Plant } from '../../db/schema'; // Adicionado Plant para o tipo de retorno

import { generatePlantCultivationContent } from './generateContent';
import {Bindings} from "hono/dist/types/types"; // Importa a função de geração

// Variável console para evitar erro em ambientes sem console global
const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

export class PlantService {
    private db: DrizzleD1Database<typeof import('../../db/schema')>; // Tipagem mais específica para o db com schema

    constructor(d1Database: D1Database) {
        // Passando o schema para o drizzle melhora a tipagem e funcionalidades
        this.db = drizzle(d1Database, { schema: { plantsTable } });
    }

    async listPlants(): Promise<Plant[]> {
        return this.db.select().from(plantsTable).all();
    }

    async getPlantById(id: number): Promise<Plant | undefined> {
        return this.db.select().from(plantsTable).where(eq(plantsTable.id, id)).get();
    }

    async getPlantBySlugAndLanguage(slug: string, language: string): Promise<Plant | undefined> {
        // Corrigido para usar AND lógico implícito entre múltiplas chamadas .where()
        return this.db.select().from(plantsTable)
            .where(eq(plantsTable.slug, slug))
            .where(eq(plantsTable.language, language)) // Adiciona a condição de linguagem
            .get();
    }

    /**
     * Cria uma nova planta. Se o conteúdo não for fornecido, tenta gerá-lo automaticamente.
     * @param env Bindings do ambiente, necessário para a chave da API Gemini.
     * @param plantData Dados da nova planta (NewPlant).
     * @returns A planta criada.
     * @throws Lança um erro se a criação falhar ou se a constraint UNIQUE for violada.
     */
    async createPlant(env: Bindings, plantData: NewPlant): Promise<Plant> {
        // Validação básica de campos obrigatórios (você pode adicionar mais se necessário)
        if (!plantData.name || !plantData.language || !plantData.slug) {
            customConsole.error("[PlantService.createPlant] Campos obrigatórios ausentes: name, language, e slug são necessários.");
            throw new Error("Campos obrigatórios ausentes: name, language, e slug são necessários.");
        }

        let finalContent: string | null = null;

        // Se o usuário forneceu conteúdo explicitamente (não é undefined), usamos esse.
        if (plantData.content !== undefined) {
            finalContent = plantData.content; // Pode ser string ou null se o usuário enviou null
            customConsole.log(`[PlantService.createPlant] Usando conteúdo fornecido pelo usuário para "${plantData.name}".`);
        } else {
            // Se plantData.content for undefined (não enviado na requisição), tentamos gerar.
            customConsole.log(`[PlantService.createPlant] Conteúdo não fornecido para "${plantData.name}". Tentando gerar...`);
            try {
                const generatedContent = await generatePlantCultivationContent(
                    env,
                    plantData.name,
                    plantData.title || null,
                    plantData.language
                );

                if (generatedContent) {
                    finalContent = generatedContent;
                    customConsole.log(`[PlantService.createPlant] Conteúdo gerado com sucesso para "${plantData.name}".`);
                } else {
                    customConsole.warn(`[PlantService.createPlant] Falha ao gerar conteúdo para "${plantData.name}" (retornou nulo ou vazio). A planta será criada com conteúdo nulo.`);
                    // finalContent já será null por padrão se a geração falhar
                }
            } catch (genError: any) {
                customConsole.error(`[PlantService.createPlant] Erro durante a geração de conteúdo para "${plantData.name}": ${genError.message}. A planta será criada com conteúdo nulo.`);
                // finalContent permanece null
            }
        }

        // Prepara os valores para inserção
        const valuesToInsert: NewPlant = {
            ...plantData, // Mantém todos os outros dados de plantData
            content: finalContent, // Adiciona o conteúdo final (fornecido, gerado ou nulo)
            // Garante que campos opcionais não definidos sejam nulos se o schema assim esperar
            scientific_name: plantData.scientific_name || null,
            title: plantData.title || null,
            brief_description: plantData.brief_description || null,
        };

        try {
            const result = await this.db.insert(plantsTable)
                .values(valuesToInsert)
                .returning() // Pede para retornar o registro inserido
                .get();      // Pega o primeiro (e único, neste caso) registro retornado

            if (!result) {
                customConsole.error(`[PlantService.createPlant] Falha ao criar planta "${plantData.name}" ou o registro não foi retornado após a inserção.`);
                throw new Error(`Falha ao criar planta "${plantData.name}" ou obter o retorno do banco de dados.`);
            }
            return result as Plant; // Faz type assertion para Plant, pois esperamos que retorne o objeto completo

        } catch (e: any) {
            customConsole.error(`[PlantService.createPlant] Erro ao inserir planta "${plantData.name}" no banco de dados:`, e.message);
            if (e.message && (e.message.includes("UNIQUE constraint failed") || (e.cause && e.cause.message && e.cause.message.includes("UNIQUE constraint failed")))) {
                customConsole.warn(`[PlantService.createPlant] Violação de constraint UNIQUE para slug "${plantData.slug}" e idioma "${plantData.language}".`);
                throw new Error(`Já existe uma planta com o mesmo slug '${plantData.slug}' e idioma '${plantData.language}'.`);
            }
            throw new Error(`Falha ao criar planta no banco de dados: ${e.message}`);
        }
    }

    async updatePlant(id: number, plantUpdateData: Partial<Omit<NewPlant, 'id'>>): Promise<Plant | undefined> {
        // Removendo 'id', 'slug', 'language' de atualizações diretas se essa for a regra de negócio.
        // No seu exemplo original, plant era Partial<NewPlant>, que permitiria mudar tudo.
        // A linha abaixo é mais restritiva, impedindo a mudança de 'id'.
        // Se slug e language são parte da chave única, talvez não devam ser atualizados facilmente.
        const { id: _id, slug: _slug, language: _lang, ...updateData } = plantUpdateData as any;

        if (Object.keys(updateData).length === 0) {
            customConsole.warn("[PlantService.updatePlant] Nenhum dado fornecido para atualização.");
            // Retornar a planta existente ou lançar um erro? Por ora, retornando undefined.
            // Ou buscar e retornar a planta atual: return this.getPlantById(id);
            return undefined;
        }

        try {
            const result = await this.db.update(plantsTable)
                .set(updateData)
                .where(eq(plantsTable.id, id))
                .returning()
                .get();
            return result;
        } catch (e: any) {
            customConsole.error(`[PlantService.updatePlant] Erro ao atualizar planta com ID ${id}:`, e.message);
            // Você pode querer tratar erros de constraint aqui também se aplicável
            throw new Error(`Falha ao atualizar planta: ${e.message}`);
        }
    }

    async deletePlant(id: number): Promise<Plant | undefined> {
        try {
            const result = await this.db.delete(plantsTable)
                .where(eq(plantsTable.id, id))
                .returning()
                .get();
            return result; // Retorna a planta deletada ou undefined se não encontrada
        } catch (e: any) {
            customConsole.error(`[PlantService.deletePlant] Erro ao deletar planta com ID ${id}:`, e.message);
            throw new Error(`Falha ao deletar planta: ${e.message}`);
        }
    }
}