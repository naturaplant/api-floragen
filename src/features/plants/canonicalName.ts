import { Bindings } from '../../types';
import { generateTextFromGemini, GenerateGeminiTextOptions } from '../ai/geminiService';

const localConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

/**
 * Obtém o nome comum mais apropriado para uma planta no idioma de destino especificado.
 * @param env Bindings do ambiente (para API Key).
 * @param userInputName Nome da planta fornecido pelo usuário (pode estar em qualquer idioma).
 * @param targetLanguageCode Código do idioma de destino (ex: "pt-BR", "en-US", "fr-FR").
 * @param targetLanguageDisplayName Nome do idioma de destino para o prompt (ex: "português do Brasil", "inglês").
 * @returns O nome canônico da planta no idioma de destino, ou o nome original se não puder ser determinado. Retorna null em caso de erro na API.
 */
export async function getCanonicalPlantNameInLanguage(
    env: Bindings,
    userInputName: string,
    targetLanguageCode: string, // Usado para lógica interna, se necessário
    targetLanguageDisplayName: string // Usado para clareza no prompt
): Promise<string | null> {
    const prompt = `
O usuário forneceu o nome de planta "${userInputName}".
Qual é o nome comum MAIS USADO E CORRETO para esta planta no idioma ${targetLanguageDisplayName}?

Instruções para a resposta:
1. Responda APENAS com o nome da planta no idioma ${targetLanguageDisplayName}.
2. Por exemplo, se o nome fornecido for 'Girasol' (considerando que o usuário pode ter digitado em espanhol) e o idioma de destino for 'inglês', a resposta deve ser 'Sunflower'.
3. Se o nome fornecido for 'Lavanda' e o idioma de destino for 'francês', a resposta deve ser 'Lavande'.
4. Se o nome fornecido for 'Rosemary' e o idioma de destino for 'português do Brasil', a resposta deve ser 'Alecrim'.
5. Se você não conseguir determinar com confiança um nome comum claro no idioma de destino, ou se o nome já estiver correto, responda com o nome original fornecido: "${userInputName}".
6. Não adicione nenhuma outra palavra, explicação ou pontuação desnecessária (como um ponto final, a menos que faça parte do nome).
    `.trim();

    const options: GenerateGeminiTextOptions = {
        prompt: prompt,
        generationConfig: {
            temperature: 0.3, // Mais factual para nomes
            maxOutputTokens: 20,  // Nomes de plantas geralmente são curtos
        }
    };

    try {
        localConsole.log(`[canonicalName] Buscando nome canônico para "${userInputName}" em ${targetLanguageDisplayName}.`);
        let canonicalName = await generateTextFromGemini(env, options);

        if (canonicalName && canonicalName.trim() !== '') {
            canonicalName = canonicalName.trim();
            // Remove ponto final se a IA adicionar e não for parte de um nome tipo "St. John's Wort"
            if (canonicalName.endsWith('.') && !canonicalName.match(/\b(St\.|Sr\.|Dr\.)/i)) {
                canonicalName = canonicalName.slice(0, -1);
            }
            localConsole.log(`[canonicalName] Nome canônico sugerido para "${userInputName}" em ${targetLanguageDisplayName}: "${canonicalName}"`);
            return canonicalName;
        } else {
            localConsole.warn(`[canonicalName] Geração de nome canônico retornou nulo ou vazio para "${userInputName}". Usando nome original.`);
            return userInputName; // Fallback para o nome original se a IA não retornar nada útil
        }
    } catch (error) {
        localConsole.error(`[canonicalName] Erro ao gerar nome canônico para "${userInputName}":`, error);
        return userInputName; // Fallback para o nome original em caso de erro na API
    }
}