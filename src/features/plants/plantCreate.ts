import { Context } from 'hono';
import { PlantService } from './plantService';
import { NewPlant, Plant } from '../../db/schema'; // Importar Plant para o tipo de retorno de sucesso
import { generateSEOTitle } from "./generateSEOTitle";
import { slugify } from "../../utils/slugify";
import {Bindings, ErrorResponsePayload} from "../../types";
 // Importar Bindings e ErrorResponsePayload

// Variável console para logs
const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

export const createPlantHandler = async (c: Context<{ Bindings: Bindings }>) => { // <--- CONTEXTO TIPADO COM BINDINGS
    const plantService = new PlantService(c.env.DB);
    let newPlantDataFromRequest: Partial<NewPlant>;

    try {
        newPlantDataFromRequest = await c.req.json();
    } catch (jsonError) {
        customConsole.error('[createPlantHandler] Erro ao parsear JSON da requisição:', jsonError);
        return c.json<ErrorResponsePayload>({ success: false, error: 'JSON malformado na requisição.' }, 400);
    }

    // Validação inicial: name e language são obrigatórios
    if (!newPlantDataFromRequest.name || !newPlantDataFromRequest.language) {
        return c.json<ErrorResponsePayload>({ success: false, error: 'Campos obrigatórios ausentes: name, language' }, 400);
    }

    // Inicializa o objeto que será passado para o serviço
    // O tipo NewPlant permite que campos opcionais sejam undefined inicialmente
    const plantToCreateInput: NewPlant = {
        name: newPlantDataFromRequest.name,
        language: newPlantDataFromRequest.language,
        scientific_name: newPlantDataFromRequest.scientific_name || null, // Garante null se undefined
        brief_description: newPlantDataFromRequest.brief_description || null, // Garante null se undefined
        content: newPlantDataFromRequest.content, // Pode ser undefined, o serviço tratará disso
        title: null, // Será determinado
        slug: '',    // Será determinado
    };

    // 1. Determinar o título
    if (newPlantDataFromRequest.title) {
        plantToCreateInput.title = newPlantDataFromRequest.title;
    } else {
        if (!c.env.GEMINI_API_KEY) {
            customConsole.warn('[createPlantHandler] GEMINI_API_KEY não está configurada. Pulando geração de título por IA.');
            if (!newPlantDataFromRequest.slug) {
                return c.json<ErrorResponsePayload>({ success: false, error: 'É necessário fornecer "title" ou "slug" se a GEMINI_API_KEY não estiver configurada para geração de título.' }, 400);
            }
            plantToCreateInput.slug = newPlantDataFromRequest.slug; // Usa slug fornecido como fallback
        } else {
            try {
                const generatedTitle = await generateSEOTitle(c.env.GEMINI_API_KEY, plantToCreateInput.name, plantToCreateInput.language);
                if (generatedTitle) {
                    plantToCreateInput.title = generatedTitle;
                } else {
                    customConsole.warn(`[createPlantHandler] Falha ao gerar título para a planta "${plantToCreateInput.name}".`);
                    if (!newPlantDataFromRequest.slug) {
                        return c.json<ErrorResponsePayload>({ success: false, error: 'Falha ao gerar título e nenhum slug foi fornecido.' }, 500);
                    }
                    plantToCreateInput.slug = newPlantDataFromRequest.slug; // Usa slug fornecido como fallback
                }
            } catch (titleError) {
                customConsole.error(`[createPlantHandler] Erro ao chamar generateSEOTitle para "${plantToCreateInput.name}":`, titleError);
                if (!newPlantDataFromRequest.slug) {
                    return c.json<ErrorResponsePayload>({ success: false, error: 'Erro na geração de título e nenhum slug foi fornecido.' }, 500);
                }
                plantToCreateInput.slug = newPlantDataFromRequest.slug; // Usa slug fornecido como fallback
            }
        }
    }

    // 2. Gerar o slug (se não foi definido anteriormente como fallback)
    if (plantToCreateInput.title && plantToCreateInput.slug === '') {
        plantToCreateInput.slug = slugify(plantToCreateInput.title);
    }

    // Garantir que temos um slug antes de continuar
    if (!plantToCreateInput.slug || plantToCreateInput.slug.trim() === '') {
        // Se o título também for nulo, significa que nem o fornecido nem o gerado funcionaram, e o slug também não.
        if (!plantToCreateInput.title) {
            return c.json<ErrorResponsePayload>({ success: false, error: 'Não foi possível determinar um título ou slug para a planta.' }, 400);
        }
        // Se temos um título mas o slugify falhou em produzir algo (improvável se o título for válido)
        plantToCreateInput.slug = slugify(plantToCreateInput.name); // Fallback final para slug a partir do nome
        if (!plantToCreateInput.slug || plantToCreateInput.slug.trim() === '') {
            return c.json<ErrorResponsePayload>({ success: false, error: 'Não foi possível determinar um slug para a planta, mesmo a partir do nome.' }, 500);
        }
        customConsole.warn(`[createPlantHandler] Slug gerado a partir do nome da planta '${plantToCreateInput.name}' como fallback final.`);
    }


    try {
        // 3. Verificar a existência usando o slug GERADO/FINAL e language
        // (Esta verificação pode ser redundante se a constraint UNIQUE no DB for suficiente,
        // mas pode fornecer uma mensagem de erro mais amigável antes de tentar o insert)
        const existingPlant = await plantService.getPlantBySlugAndLanguage(plantToCreateInput.slug, plantToCreateInput.language);
        if (existingPlant) {
            return c.json<ErrorResponsePayload>(
                { success: false, error: `Planta com slug '${plantToCreateInput.slug}' e idioma '${plantToCreateInput.language}' já existe.` },
                409 // Conflict
            );
        }

        // 4. Chamar o método createPlant do serviço, AGORA PASSANDO c.env
        // O plantService.createPlant internamente tentará gerar o campo "content" se plantToCreateInput.content for undefined.
        const createdPlant = await plantService.createPlant(c.env, plantToCreateInput);

        return c.json<{ success: true, plant: Plant }>({ success: true, plant: createdPlant }, 201);

    } catch (error: unknown) {
        let errorMessage = 'Falha ao criar a planta.';
        let statusCode = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            // Erros específicos que o PlantService.createPlant pode lançar
            if (error.message.includes("Já existe uma planta com o mesmo slug") || error.message.includes("UNIQUE constraint failed")) {
                statusCode = 409; // Conflict
            } else if (error.message.includes("Campos obrigatórios ausentes")) {
                statusCode = 400; // Bad Request
            } else if (error.message.includes("Falha ao gerar texto com Gemini")) {
                // Se o erro foi especificamente na geração de conteúdo, podemos querer um status diferente
                // ou apenas logar e continuar com o erro 500 genérico, já que a planta não foi criada.
                customConsole.error(`[createPlantHandler] Erro específico da API Gemini durante createPlant: ${errorMessage}`);
            }
        }

        customConsole.error(`[createPlantHandler] Erro final ao processar criação da planta: ${errorMessage}`, error);
        return c.json<ErrorResponsePayload>({ success: false, error: errorMessage }, statusCode);
    }
};