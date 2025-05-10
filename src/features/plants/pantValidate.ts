import { Context } from 'hono';
import { PlantService } from './plantService';
import { NewPlant } from '../../db/schema';
import { generateScientificName } from "./scientificName";
import { getCanonicalPlantNameInLanguage } from './canonicalName';
import { isCultivablePlant } from './plantTypeValidation'; // <--- IMPORTADO
import { Bindings } from "../../types";

const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

export interface PlantValidationResult {
    isValid: boolean;
    data?: Partial<NewPlant>;
    error?: string;
    statusCode?: number;
}

export async function validatePlantBasicInfo(
    c: Context<{ Bindings: Bindings }>,
    plantService: PlantService,
    newPlantDataFromRequest: Partial<NewPlant>
): Promise<PlantValidationResult> {

    if (!newPlantDataFromRequest.name || !newPlantDataFromRequest.language) {
        return { isValid: false, error: 'Campos obrigatórios ausentes: name, language', statusCode: 400 };
    }

    const userInputName = newPlantDataFromRequest.name.trim();
    const targetLanguageCode = newPlantDataFromRequest.language;
    const targetLanguageDisplayName = targetLanguageCode.toLowerCase().startsWith('pt') ? 'português do Brasil' : targetLanguageCode;

    let canonicalPlantName = userInputName;
    if (c.env.GEMINI_API_KEY) {
        try {
            const aiSuggestedName = await getCanonicalPlantNameInLanguage(c.env, userInputName, targetLanguageCode, targetLanguageDisplayName);
            if (aiSuggestedName && aiSuggestedName.trim() !== '') {
                customConsole.log(`[plantValidate] Nome canônico para "${userInputName}" em ${targetLanguageDisplayName} sugerido pela IA: "${aiSuggestedName}"`);
                canonicalPlantName = aiSuggestedName.trim();
            } else {
                customConsole.warn(`[plantValidate] IA não sugeriu um nome canônico para "${userInputName}", usando input original.`);
            }
        } catch (nameError: any) {
            customConsole.error(`[plantValidate] Erro ao obter nome canônico para "${userInputName}": ${nameError.message}. Usando input original.`);
        }
    } else {
        customConsole.warn('[plantValidate] GEMINI_API_KEY não configurada. Usando nome de input original para verificações e como nome canônico.');
    }

    // *** NOVA VALIDAÇÃO: Verificar se é uma planta cultivável ***
    if (c.env.GEMINI_API_KEY) {
        const isPlant = await isCultivablePlant(c.env, canonicalPlantName, targetLanguageDisplayName);
        if (!isPlant) {
            customConsole.warn(`[plantValidate] O termo "${canonicalPlantName}" não foi identificado como uma planta cultivável pela IA.`);
            return {
                isValid: false,
                error: `O termo "${canonicalPlantName}" não parece ser uma planta cultivável. Por favor, insira um nome de planta válido.`,
                statusCode: 400 // Requisição Inválida
            };
        }
        customConsole.log(`[plantValidate] O termo "${canonicalPlantName}" foi validado como uma planta cultivável pela IA.`);
    } else {
        customConsole.warn('[plantValidate] GEMINI_API_KEY não configurada. Pulando validação de tipo de planta (se é cultivável).');
        // Sem a chave da API, não podemos fazer essa validação.
        // Você pode decidir se quer bloquear ou permitir o cadastro neste caso.
        // Por ora, ele prosseguirá, mas é um ponto de atenção.
    }

    // Verificar se já existe planta com o NOME CANÔNICO e IDIOMA
    try {
        const existingPlantByName = await plantService.getPlantByNameAndLanguage(canonicalPlantName, targetLanguageCode);
        if (existingPlantByName) {
            customConsole.warn(`[plantValidate] Planta com nome (canônico) '${canonicalPlantName}' e idioma '${targetLanguageCode}' já existe (ID: ${existingPlantByName.id}).`);
            return {
                isValid: false,
                error: `Planta com nome '${canonicalPlantName}' e idioma '${targetLanguageCode}' já existe.`,
                statusCode: 409
            };
        }
    } catch (dbError: any) {
        customConsole.error(`[plantValidate] Erro ao verificar planta por nome canônico e idioma: ${dbError.message}`);
        return { isValid: false, error: 'Erro interno ao verificar existência da planta por nome.', statusCode: 500 };
    }

    const validatedData: Partial<NewPlant> = {
        ...newPlantDataFromRequest,
        name: canonicalPlantName,
        language: targetLanguageCode,
        scientific_name: newPlantDataFromRequest.scientific_name || null,
    };

    if (validatedData.scientific_name === null) {
        if (c.env.GEMINI_API_KEY) {
            customConsole.log(`[plantValidate] Nome científico não fornecido para "${canonicalPlantName}". Tentando gerar...`);
            try {
                const generatedSciName = await generateScientificName(c.env, canonicalPlantName, targetLanguageCode);
                if (generatedSciName && generatedSciName.toLowerCase() !== "informação não disponível." && generatedSciName.trim() !== "") {
                    validatedData.scientific_name = generatedSciName;
                } else {
                    validatedData.scientific_name = null;
                }
            } catch (sciNameError: any) {
                customConsole.error(`[plantValidate] Erro ao gerar nome científico para "${canonicalPlantName}": ${sciNameError.message}`);
                validatedData.scientific_name = null;
            }
        } else {
            customConsole.warn('[plantValidate] GEMINI_API_KEY não configurada. Pulando geração de nome científico.');
        }
    }

    customConsole.log(`[plantValidate] Validação básica bem-sucedida para nome canônico "${validatedData.name}".`);
    return {
        isValid: true,
        data: validatedData
    };
}