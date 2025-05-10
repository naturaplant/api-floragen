import { Bindings } from '../../types';
import { generateTextFromGemini, GenerateGeminiTextOptions } from '../ai/geminiService';

const localConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

/**
 * Verifica com a IA se um nome fornecido refere-se a uma planta cultivável.
 * @param env Bindings do ambiente (para API Key).
 * @param plantName O nome canônico da planta a ser verificado.
 * @param languageDisplayName O nome do idioma para o prompt (ex: "português do Brasil").
 * @returns `true` se for uma planta cultivável, `false` caso contrário ou em caso de erro.
 */
export async function isCultivablePlant(
    env: Bindings,
    plantName: string,
    languageDisplayName: string
): Promise<boolean> {
    const prompt = `
O termo "${plantName}" (no idioma ${languageDisplayName}) refere-se a um tipo de planta que pode ser cultivada (como uma flor, árvore frutífera, arbusto ornamental, vegetal, erva aromática, etc.)?
Responda EXCLUSIVAMENTE com "sim" ou "não".
    `.trim();

    const options: GenerateGeminiTextOptions = {
        prompt: prompt,
        generationConfig: {
            temperature: 0.1, // Muito factual para uma resposta sim/não
            maxOutputTokens: 5,  // "sim" ou "não" são curtos
        }
    };

    try {
        localConsole.log(`[isCultivablePlant] Verificando se "${plantName}" (${languageDisplayName}) é uma planta cultivável.`);
        const response = await generateTextFromGemini(env, options);

        if (response) {
            const cleanedResponse = response.trim().toLowerCase();
            localConsole.log(`[isCultivablePlant] Resposta da IA para "${plantName}": "${cleanedResponse}"`);
            if (cleanedResponse === "sim") {
                return true;
            } else if (cleanedResponse === "não") {
                return false;
            } else {
                localConsole.warn(`[isCultivablePlant] Resposta inesperada da IA para "${plantName}": "${response}". Assumindo que não é uma planta cultivável.`);
                return false; // Resposta não reconhecida, assume não
            }
        } else {
            localConsole.warn(`[isCultivablePlant] A verificação de planta cultivável para "${plantName}" retornou nulo ou vazio. Assumindo que não é.`);
            return false; // Sem resposta, assume não
        }
    } catch (error) {
        localConsole.error(`[isCultivablePlant] Erro ao verificar se "${plantName}" é planta cultivável:`, error);
        return false; // Em caso de erro na API, assume que não é para segurança
    }
}