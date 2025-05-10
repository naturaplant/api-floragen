// src/features/plants/plantCreate.ts
import { Context } from 'hono';
import { PlantService } from './plantService';
import { NewPlant, Plant } from '../../db/schema';
import { generateSEOTitle } from "./generateSEOTitle";
import { generateBriefDescription } from "./briefDescription";
// generateScientificName não é mais chamado diretamente aqui, mas sim dentro de plantValidate
import { slugify } from "../../utils/slugify";
import { Bindings, ErrorResponsePayload } from "../../types";
import {validatePlantBasicInfo} from "./pantValidate";


const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

export const createPlantHandler = async (c: Context<{ Bindings: Bindings }>) => {
    const plantService = new PlantService(c.env.DB);
    let newPlantDataFromRequest: Partial<NewPlant>;

    try {
        newPlantDataFromRequest = await c.req.json();
    } catch (jsonError) {
        customConsole.error('[createPlantHandler] Erro ao parsear JSON da requisição:', jsonError);
        return c.json<ErrorResponsePayload>({ success: false, error: 'JSON malformado na requisição.' }, 400);
    }

    // 1. Validação básica e de nome/idioma (e geração de nome científico)
    const validationResult = await validatePlantBasicInfo(c, plantService, newPlantDataFromRequest);

    if (!validationResult.isValid || !validationResult.data) {
        customConsole.error(`[createPlantHandler] Validação básica falhou: ${validationResult.error}`);
        return c.json<ErrorResponsePayload>({ success: false, error: validationResult.error! }, validationResult.statusCode || 400);
    }

    // Dados parcialmente preenchidos de plantValidate (name, language, scientific_name, e o que mais veio na request)
    const processedPlantData: Partial<NewPlant> = validationResult.data;

    // 2. Determinar o Título (se não veio na requisição)
    let finalTitle: string | null = processedPlantData.title || null;
    if (finalTitle === null && (!newPlantDataFromRequest.slug || newPlantDataFromRequest.slug.trim() === '')) { // Só gera título se não foi dado e slug também não foi (ou é vazio)
        if (c.env.GEMINI_API_KEY) {
            customConsole.log(`[createPlantHandler] Título não fornecido para "${processedPlantData.name}". Tentando gerar...`);
            try {
                const generatedTitle = await generateSEOTitle(c.env.GEMINI_API_KEY, processedPlantData.name!, processedPlantData.language!);
                if (generatedTitle) {
                    finalTitle = generatedTitle;
                } else {
                    customConsole.warn(`[createPlantHandler] Falha ao gerar título para "${processedPlantData.name}". Título será nulo.`);
                }
            } catch (titleError: any) {
                customConsole.error(`[createPlantHandler] Erro ao gerar título: ${titleError.message}`);
                // Mantém finalTitle como null
            }
        } else {
            customConsole.warn('[createPlantHandler] GEMINI_API_KEY não configurada. Pulando geração de título por IA.');
        }
    }

    // 3. Determinar o Slug
    let finalSlug: string;
    if (newPlantDataFromRequest.slug && newPlantDataFromRequest.slug.trim() !== '') {
        finalSlug = slugify(newPlantDataFromRequest.slug.trim());
        customConsole.log(`[createPlantHandler] Usando slug fornecido e normalizado: "${finalSlug}"`);
    } else if (finalTitle) {
        finalSlug = slugify(finalTitle);
        customConsole.log(`[createPlantHandler] Slug gerado a partir do título "${finalTitle}": "${finalSlug}"`);
    } else {
        // Fallback final: gerar slug a partir do nome da planta
        finalSlug = slugify(processedPlantData.name!);
        customConsole.warn(`[createPlantHandler] Slug gerado a partir do NOME da planta "${processedPlantData.name}" como fallback: "${finalSlug}"`);
    }

    if (!finalSlug || finalSlug.trim() === '') {
        return c.json<ErrorResponsePayload>({ success: false, error: 'Não foi possível determinar um slug válido para a planta.' }, 500);
    }

    // Monta o objeto final para o serviço createPlant
    // Os campos content e brief_description ainda podem ser undefined aqui,
    // o PlantService.createPlant cuidará de gerá-los se necessário.
    const plantToInsert: NewPlant = {
        name: processedPlantData.name!,
        language: processedPlantData.language!,
        slug: finalSlug,
        title: finalTitle,
        scientific_name: processedPlantData.scientific_name || null,
        content: newPlantDataFromRequest.content, // Passa o content original (pode ser undefined)
        brief_description: newPlantDataFromRequest.brief_description, // Passa brief_description original (pode ser undefined)
    };

    try {
        let createdPlant = await plantService.createPlant(c.env, plantToInsert);

        // Geração de brief_description após criação (se não foi fornecida e content existe)
        // Esta lógica pode permanecer aqui ou ser totalmente encapsulada no PlantService,
        // dependendo da sua preferência. A última versão do PlantService já incluía isso.
        // Se PlantService já faz, este bloco pode ser removido ou ajustado.
        // Vou assumir que PlantService já cuida disso conforme nossa última revisão dele.
        // Se precisar que o handler force a atualização da brief_description, o bloco abaixo seria usado.
        /*
        if (newPlantDataFromRequest.brief_description === undefined && createdPlant.content && c.env.GEMINI_API_KEY) {
            customConsole.log(`[createPlantHandler] brief_description não fornecida para "${createdPlant.name}". Tentando gerar e atualizar...`);
            try {
                const generatedBriefDesc = await generateBriefDescription(
                    c.env,
                    createdPlant.name,
                    createdPlant.content,
                    createdPlant.language
                );
                if (generatedBriefDesc) {
                    const updatedPlantWithBriefDesc = await plantService.updatePlant(createdPlant.id, { brief_description: generatedBriefDesc });
                    if (updatedPlantWithBriefDesc) {
                        createdPlant = updatedPlantWithBriefDesc;
                    }
                }
            } catch (briefDescError: any) {
                customConsole.error(`[createPlantHandler] Erro ao gerar/atualizar brief_description para "${createdPlant.name}": ${briefDescError.message}`);
            }
        }
        */

        return c.json<{ success: true, plant: Plant }>({ success: true, plant: createdPlant }, 201);

    } catch (error: unknown) {
        let errorMessage = 'Falha ao criar a planta.';
        let statusCode = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            // O erro de UNIQUE constraint para slug+language será pego aqui
            if (error.message.includes("Já existe uma planta com o mesmo slug") || error.message.includes("UNIQUE constraint failed")) {
                statusCode = 409;
                // A mensagem de erro do PlantService já é "Planta com slug '...' e idioma '...' já existe."
            } else if (error.message.includes("Campos obrigatórios ausentes")) {
                statusCode = 400;
            }
        }
        customConsole.error(`[createPlantHandler] Erro final ao processar criação da planta: ${errorMessage}`, error);
        return c.json<ErrorResponsePayload>({ success: false, error: errorMessage }, statusCode);
    }
};