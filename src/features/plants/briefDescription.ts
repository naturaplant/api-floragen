import { Bindings } from '../../types';
import { generateTextFromGemini, GenerateGeminiTextOptions } from '../ai/geminiService';

// Corrigido para 'customConsole' ou apenas 'console' se preferir.
// A ideia é ter um fallback se console global não estiver disponível em algum ambiente de teste.
const customConsole = globalThis.console || { log: () => {}, warn: () => {}, error: () => {} };

async function generateBriefDescription(
    env: Bindings,
    plantName: string,
    articleContent: string,
    language: string
): Promise<string | null> {
    const targetLanguage = language.toLowerCase().startsWith('pt') ? 'português do Brasil' : 'inglês';
    const charLimitLower = 140;
    const charLimitUpper = 160;

    // Removemos os primeiros 7500 caracteres do articleContent para garantir que o prompt não fique excessivamente longo.
    // Isso ajuda a manter a requisição dentro de limites razoáveis de tokens de entrada e foca no conteúdo principal.
    // O Gemini 1.5 Flash tem uma janela de contexto grande, mas é uma boa prática não enviar mais dados do que o necessário.
    // 7500 caracteres são aproximadamente 1500-1800 palavras, o que deve ser mais que suficiente para uma boa meta description.
    const relevantArticleContent = articleContent.substring(0, 7500);


    const prompt = `
Com base no seguinte artigo sobre a planta "${plantName}", gere uma meta description (breve descrição) concisa e otimizada para SEO.

REGRAS E OBJETIVOS PARA A DESCRIÇÃO:
1. Idioma: ${targetLanguage}.
2. Comprimento: Idealmente entre ${charLimitLower} e ${charLimitUpper} caracteres. Não exceda ${charLimitUpper} caracteres.
3. Conteúdo: Deve resumir os pontos mais importantes e atraentes do artigo sobre "${plantName}", incentivando o clique em mecanismos de busca.
4. SEO: Use palavras-chave relevantes que alguém usaria para pesquisar sobre como cultivar ou para que serve a planta "${plantName}".
5. Clareza e Atratividade: A descrição deve ser clara, direta e suficientemente interessante para ser usada em snippets de busca (Google) e ser considerada de alta qualidade para Google AdSense.
6. Formato: Apenas texto puro, uma única frase ou duas no máximo. Não use quebras de linha dentro da descrição.

Artigo de Referência:
---
${relevantArticleContent}
---

Gere APENAS a meta description otimizada.
    `.trim();

    const options: GenerateGeminiTextOptions = {
        prompt: prompt,
        generationConfig: {
            temperature: 0.7, // Um bom equilíbrio para descrições criativas mas factuais
            maxOutputTokens: 100, // Deve ser suficiente para ~160 caracteres (1 token ~4 chars; 160/4 = 40 tokens. 100 dá uma boa margem)
        }
    };

    try {
        customConsole.log(`[generateBriefDescription] Gerando brief_description para "${plantName}" em ${targetLanguage}.`);
        const generatedDescription = await generateTextFromGemini(env, options);

        if (generatedDescription && generatedDescription.trim() !== '') {
            const trimmedDescription = generatedDescription.trim();
            customConsole.log(`[generateBriefDescription] brief_description para "${plantName}" gerada: "${trimmedDescription}" (Comprimento: ${trimmedDescription.length})`);

            // Log de aviso se o comprimento estiver muito fora do ideal, mas ainda retorna o resultado.
            // A LLM pode nem sempre seguir as instruções de comprimento perfeitamente.
            if (trimmedDescription.length < 100 || trimmedDescription.length > charLimitUpper + 20) { // Uma margem um pouco maior para o aviso
                customConsole.warn(`[generateBriefDescription] A descrição gerada para "${plantName}" tem ${trimmedDescription.length} caracteres. O ideal é entre ${charLimitLower}-${charLimitUpper}.`);
            }
            return trimmedDescription;
        } else {
            customConsole.warn(`[generateBriefDescription] A geração de brief_description para "${plantName}" retornou nulo ou vazio.`);
            return null;
        }
    } catch (error) {
        customConsole.error(`[generateBriefDescription] Erro ao gerar brief_description para "${plantName}":`, error);
        return null;
    }
}

export { generateBriefDescription };