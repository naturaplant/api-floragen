import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateSEOTitle(apiKey: string, plantName: string, language: string): Promise<string | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"}); // Você pode ajustar o modelo conforme necessário

        const prompt = `
        Gere um título de artigo para um blog sobre a planta "${plantName}".
        O título deve ser:
        1. SEO otimizado.
        2. Memorável e interessante para atrair leitores.
        3. Evitar frases genéricas e repetitivas como "Como cuidar de", "Saiba mais sobre", "Guia completo", etc.
        4. Ser um pouco mais descritivo do que apenas o nome da planta, sugerindo o que o leitor aprenderá ou descobrirá.
        5. Estar no idioma "${language}".

        Exemplos de títulos que NÃO quero:
        - Orquídea Borboleta
        - Guia sobre Rosas
        - Saiba mais sobre Suculentas

        Exemplos de títulos que quero:
        - Desvendando os Segredos do Cultivo da Orquídea Borboleta
        - Rosas Vibrantes: Dicas Essenciais para um Jardim Florido
        - Suculentas para Iniciantes: Guia Prático de Cuidados e Tipos

        Por favor, gere apenas o título, sem qualquer introdução ou texto adicional.
    `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // A IA pode retornar aspas ou outros caracteres no início/fim, vamos tentar limpar isso.
        // Também garantir que retorne apenas a primeira linha, caso a IA seja verborrágica.
        const cleanedTitle = text
            .trim()
            .replace(/^["'\s]+|["'\s]+$/g, '') // Remove aspas ou espaços no início/fim
            .split('\n')[0]; // Pega apenas a primeira linha

        return cleanedTitle || null;

    } catch (error) {
        console.error('Error calling Google Generative AI:', error);
        return null; // Retorna null em caso de erro
    }
}