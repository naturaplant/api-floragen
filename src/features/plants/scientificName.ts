import { Bindings } from '../../types';
import { generateTextFromGemini, GenerateGeminiTextOptions } from '../ai/geminiService';

const localConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

async function generateScientificName(
    env: Bindings,
    plantName: string,
    language: string
): Promise<string | null> {
    const targetLanguage = language.toLowerCase().startsWith('pt') ? 'português do Brasil' : 'inglês';
    const notAvailableResponse = "Informação não disponível.";

    const prompt = `
Forneça o nome científico (gênero e espécie) mais comum e reconhecido para a planta popularmente conhecida como "${plantName}" (considerando o nome comum em ${targetLanguage}).

REGRAS PARA A RESPOSTA:
1. Retorne APENAS o nome científico no formato "Gênero espécie" (ex: "Solanum lycopersicum").
2. Se houver múltiplas variedades comuns e um nome científico específico for difícil de determinar para "${plantName}", forneça o nome do gênero principal seguido de "spp." (ex: "Rosa spp.").
3. Se um nome científico confiável não puder ser encontrado para "${plantName}", responda EXATAMENTE com: "${notAvailableResponse}".
4. Não inclua nenhuma palavra, explicação ou formatação adicional além do solicitado. A resposta deve ser somente o nome científico ou a frase de indisponibilidade.
    `.trim();

    const options: GenerateGeminiTextOptions = {
        prompt: prompt,
        generationConfig: {
            temperature: 0.2, // Baixa temperatura para respostas mais factuais e menos criativas
            maxOutputTokens: 20,  // Nomes científicos são curtos; 20 tokens são suficientes
        }
    };

    try {
        localConsole.log(`[generateScientificName] Gerando nome científico para "${plantName}" em ${targetLanguage}.`);
        let scientificName = await generateTextFromGemini(env, options);

        if (scientificName && scientificName.trim() !== '') {
            scientificName = scientificName.trim();
            // Remove um ponto final se a IA adicionar um por engano e não for a frase "Informação não disponível."
            if (scientificName.endsWith('.') && scientificName !== notAvailableResponse) {
                scientificName = scientificName.substring(0, scientificName.length - 1);
            }

            localConsole.log(`[generateScientificName] Nome científico para "${plantName}" gerado: "${scientificName}"`);
            // Validação simples para ver se parece um nome científico (ex: duas palavras, primeira capitalizada)
            // ou se é a resposta de "não disponível".
            const parts = scientificName.split(' ');
            if (scientificName === notAvailableResponse || (parts.length >= 1 && parts[0][0] === parts[0][0].toUpperCase())) {
                return scientificName;
            } else {
                localConsole.warn(`[generateScientificName] O nome científico gerado "${scientificName}" para "${plantName}" não parece estar no formato esperado. Retornando "${notAvailableResponse}".`);
                return notAvailableResponse; // Fallback se o formato for muito inesperado
            }
        } else {
            localConsole.warn(`[generateScientificName] A geração de nome científico para "${plantName}" retornou nulo ou vazio. Retornando "${notAvailableResponse}".`);
            return notAvailableResponse;
        }
    } catch (error) {
        localConsole.error(`[generateScientificName] Erro ao gerar nome científico para "${plantName}":`, error);
        return notAvailableResponse; // Retorna a string padrão em caso de erro na API
    }
}

export { generateScientificName };