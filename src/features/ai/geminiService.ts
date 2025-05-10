// src/features/ai/geminiService.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';
import { Bindings } from '../../types'; // Ajuste o caminho se sua estrutura de pastas for diferente

let genAIInstance: GoogleGenerativeAI | null = null;

function getGoogleGenerativeAIInstance(apiKey: string): GoogleGenerativeAI {
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
        console.log("Instância do GoogleGenerativeAI Client criada.");
    }
    return genAIInstance;
}

export interface GenerateGeminiTextOptions {
    prompt: string;
    modelName?: string;      // Ex: "gemini-1.5-flash-latest"
    generationConfig?: GenerationConfig; // Para maxOutputTokens, temperature, topP, topK
}

export async function generateTextFromGemini(
    env: Bindings,
    options: GenerateGeminiTextOptions
): Promise<string | null> {
    try {
        // --- INÍCIO DOS LOGS DE DEPURAÇÃO DA CHAVE ---
        console.log(`[geminiService] Tentando acessar GEMINI_API_KEY.`);
        if (env.GEMINI_API_KEY) {
            console.log(`[geminiService] GEMINI_API_KEY está presente no env.`);
            // CUIDADO: Os logs abaixo são para depuração local. Não exponha a chave completa em produção.
            console.log(`[geminiService] GEMINI_API_KEY (primeiros 5 caracteres): ${env.GEMINI_API_KEY.substring(0, 5)}...`);
            console.log(`[geminiService] GEMINI_API_KEY (últimos 5 caracteres): ...${env.GEMINI_API_KEY.substring(env.GEMINI_API_KEY.length - 5)}`);
            console.log(`[geminiService] GEMINI_API_KEY (comprimento): ${env.GEMINI_API_KEY.length}`);

            // Chaves da Google AI geralmente começam com "AIza" e têm 39 caracteres.
            if (!env.GEMINI_API_KEY.startsWith("AIza") || env.GEMINI_API_KEY.length !== 39) {
                console.warn("[geminiService] ALERTA DE DEPURAÇÃO: A GEMINI_API_KEY não parece ter o formato esperado (começar com 'AIza' e ter 39 caracteres). Verifique a chave!");
            }
        } else {
            console.error("[geminiService] ERRO CRÍTICO DE DEPURAÇÃO: GEMINI_API_KEY NÃO FOI ENCONTRADA NO AMBIENTE (env).");
            // Esta verificação abaixo já existia e é importante.
        }
        // --- FIM DOS LOGS DE DEPURAÇÃO DA CHAVE ---

        if (!env.GEMINI_API_KEY) { // Verificação crucial
            console.error("[geminiService] Erro: GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
            throw new Error("Chave da API Gemini não configurada.");
        }

        const genAI = getGoogleGenerativeAIInstance(env.GEMINI_API_KEY);
        const {
            prompt,
            modelName = "gemini-1.5-flash-latest", // Modelo recomendado para Flash
            generationConfig = {
                temperature: 0.7,
                maxOutputTokens: 2048, // Gemini 1.5 Flash suporta até 8192 para output. Ajuste conforme necessário.
            }
        } = options;

        console.log(`[geminiService] Chamando Gemini API com prompt: "${prompt.substring(0, 100)}..." e modelo: ${modelName}`);
        console.log(`[geminiService] Usando generationConfig:`, JSON.stringify(generationConfig));


        const model = genAI.getGenerativeModel({
            model: modelName,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
            generationConfig: generationConfig
        });

        const result = await model.generateContent(prompt);
        const response = result.response;

        let fullText = "";
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    fullText += part.text;
                }
            }
        }

        if (fullText) {
            console.log("[geminiService] Texto gerado pela Gemini API com sucesso.");
            return fullText;
        } else {
            console.error("[geminiService] Nenhum texto utilizável retornado pela Gemini API. Verifique promptFeedback. Resposta completa:", JSON.stringify(response, null, 2));
            if (response.promptFeedback?.blockReason) {
                const blockReason = response.promptFeedback.blockReason;
                const blockMessage = response.promptFeedback.blockReasonMessage || blockReason;
                console.error(`[geminiService] Geração bloqueada pela API Gemini. Motivo: ${blockReason}, Mensagem: ${blockMessage}`);
                // Verifique se existem 'safetyRatings' para mais detalhes
                if (response.promptFeedback.safetyRatings && response.promptFeedback.safetyRatings.length > 0) {
                    console.error('[geminiService] Safety Ratings detalhadas:', JSON.stringify(response.promptFeedback.safetyRatings, null, 2));
                }
                throw new Error(`Geração de texto bloqueada pela API Gemini: ${blockMessage} (Motivo: ${blockReason})`);
            }
            // Se não foi bloqueado, mas ainda assim não há texto, é um problema diferente
            throw new Error("Resposta da API Gemini não continha texto utilizável, e não foi explicitamente bloqueada por segurança.");
        }

    } catch (error: any) {
        console.error('[geminiService] Erro capturado na função generateTextFromGemini:', error.message || error);
        if (error.name === 'GoogleGenerativeAIError') { // Erro específico do SDK
            console.error('[geminiService] Detalhes do GoogleGenerativeAIError:', error);
        }
        // Relança o erro para ser tratado pela rota que chamou este serviço
        // Mantém a mensagem original do erro se disponível, ou a mensagem genérica.
        throw new Error(`Falha ao gerar texto com Gemini: ${error.message || 'Erro desconhecido no serviço Gemini.'}`);
    }
}