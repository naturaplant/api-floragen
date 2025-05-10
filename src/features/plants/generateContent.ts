// src/features/plants/generateContent.ts

import { generateTextFromGemini, GenerateGeminiTextOptions } from '../ai/geminiService';
import {Bindings} from "hono/dist/types/types";

/**
 * Gera o conteúdo principal (artigo) sobre como cultivar uma planta,
 * utilizando a API Gemini e seguindo uma estrutura específica.
 * @param env Os bindings do ambiente Cloudflare (contendo GEMINI_API_KEY).
 * @param plantName O nome da planta.
 * @param plantTitle O título fornecido para a planta (pode ser usado para contexto).
 * @param language O idioma para a geração do conteúdo (ex: 'pt_BR', 'en_US').
 * @returns Uma string com o conteúdo gerado ou null em caso de falha.
 */
export async function generatePlantCultivationContent(
    env: Bindings,
    plantName: string,
    plantTitle: string | null,
    language: string
): Promise<string | null> {
    const targetLanguage = language.toLowerCase().startsWith('pt') ? 'português do Brasil' : 'inglês';

    // O prompt é baseado no seu exemplo, com as variáveis interpoladas.
    const prompt = `
Crie um artigo informativo e prático ensinando como plantar e cuidar da planta "${plantName}", cujo título principal para contexto é "${plantTitle || plantName}".
Siga ESTRITAMENTE a seguinte estrutura de seções e formato:

🌱 Como Plantar ${plantName}
[Escreva um parágrafo claro e detalhado explicando o processo de plantio desta espécie. Inclua informações sobre sementes/mudas, profundidade, espaçamento e primeiros cuidados.]

🔬 Nome Científico
[Informe o nome científico (gênero e espécie) mais comum para "${plantName}". Se houver muitas variedades ou incerteza, mencione isso brevemente ou indique o gênero principal (ex: Rosa spp.). Se não encontrar informação confiável, escreva apenas "Informação não disponível.".]

🌤️ Clima Ideal
[Descreva detalhadamente as condições climáticas ideais: faixa de temperatura preferida, tolerância ao frio/calor, necessidade de umidade atmosférica e adequação a climas específicos (tropical, temperado, etc.).]

🌱 Tipo de Solo
[Detalhe o tipo de solo perfeito para "${plantName}". Inclua informações sobre drenagem (essencial!), pH ideal, textura (arenoso, argiloso, etc.) e recomendação de mistura ou como preparar o solo existente.]

💧 Rega
[Forneça instruções precisas sobre a rega: frequência (considerando estações do ano e fase da planta), quantidade de água, melhor método (direto no solo, evitar molhar folhas?), e a importância de verificar a umidade do solo antes de regar novamente.]

☀️ Luz
[Explique a exigência de luz solar: quantas horas de sol direto por dia são necessárias (ou se prefere luz indireta), qual a intensidade ideal (sol da manhã, sol pleno, meia-sombra), e os riscos de luz insuficiente ou excessiva.]

✨ Dicas Extras de Cultivo
[Ofereça 2-3 dicas adicionais valiosas e práticas. Podem incluir: adubação (tipo, frequência), poda (quando, como), propagação (métodos fáceis), prevenção/controle de pragas e doenças comuns, ou outros cuidados específicos relevantes para "${plantName}".]

REGRAS DE FORMATAÇÃO ABSOLUTAMENTE OBRIGATÓRIAS:
1. Use EXATAMENTE os títulos de seção fornecidos acima, incluindo os emojis e o nome da planta onde indicado.
2. Separe CADA seção (título + parágrafo(s) da seção) da próxima por EXATAMENTE duas quebras de linha (ENTER duplo: \\n\\n).
3. Escreva TODO o conteúdo em texto puro. NÃO use NENHUM HTML, Markdown (sem **, _, *, -, #, 1.), bullet points ou numeração. Apenas parágrafos de texto simples.
4. NÃO inclua um título geral no início do artigo, nem introdução ou conclusão/despedida no final. Comece diretamente com a primeira seção e termine após a última.
5. Escreva todo o texto em ${targetLanguage}, usando linguagem clara, objetiva e acessível, mesmo ao abordar termos técnicos.
`.trim();

    const options: GenerateGeminiTextOptions = {
        prompt: prompt,
        // Você pode querer ajustar a configuration de geração para este tipo de conteúdo.
        // Artigos detalhados podem precisar de mais tokens.
        generationConfig: {
            temperature: 0.6, // Um pouco menos criativo para conteúdo mais factual.
            maxOutputTokens: 3500, // Aumentado para permitir um artigo bem detalhado. Ajuste conforme testes.
            // topP: 0.95, // Exemplo
            // topK: 40,   // Exemplo
        }
    };

    try {
        console.log(`[generateContent] Gerando conteúdo para "${plantName}" em ${targetLanguage}. Título de contexto: "${plantTitle || plantName}"`);
        const generatedArticle = await generateTextFromGemini(env, options);
        if (generatedArticle) {
            console.log(`[generateContent] Conteúdo para "${plantName}" gerado com sucesso.`);
            // Poderíamos adicionar uma verificação extra aqui para garantir que as seções principais estão presentes,
            // mas isso adicionaria complexidade. Por enquanto, confiamos no prompt.
            return generatedArticle;
        } else {
            console.warn(`[generateContent] A geração de conteúdo para "${plantName}" retornou nulo ou vazio.`);
            return null;
        }
    } catch (error) {
        console.error(`[generateContent] Erro ao gerar conteúdo para "${plantName}":`, error);
        // Retornar null ou relançar o erro, dependendo de como você quer tratar na camada de serviço.
        return null;
    }
}