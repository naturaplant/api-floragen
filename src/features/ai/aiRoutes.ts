// src/features/ai/aiRoutes.ts
import { Hono } from 'hono';
import { Bindings, ErrorResponsePayload } from '../../types';
import { generateTextFromGemini, GenerateGeminiTextOptions } from './geminiService';
import { GenerationConfig } from '@google/generative-ai'; // Importe se for passar diretamente

const aiRoutes = new Hono<{ Bindings: Bindings }>();

type GenerateArticleSuccessResponse = {
    success: boolean;
    article: string | null;
};

aiRoutes.post('/generate-article', async (c) => {
    try {
        const body = await c.req.json<{ prompt: string; modelName?: string; generationConfig?: GenerationConfig }>();

        if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim() === '') {
            return c.json<ErrorResponsePayload>({ success: false, error: "O 'prompt' é obrigatório e deve ser uma string não vazia." }, 400);
        }

        const options: GenerateGeminiTextOptions = {
            prompt: body.prompt,
        };
        if (body.modelName) options.modelName = body.modelName;
        if (body.generationConfig) options.generationConfig = body.generationConfig;

        const articleContent = await generateTextFromGemini(c.env, options);

        if (articleContent) {
            return c.json<GenerateArticleSuccessResponse>({ success: true, article: articleContent }, 200);
        } else {
            // O serviço agora pode lançar um erro mais específico se a geração for bloqueada
            return c.json<ErrorResponsePayload>({ success: false, error: 'Falha ao gerar o artigo ou conteúdo vazio retornado pela API Gemini.' }, 500);
        }
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido ao gerar o artigo com Gemini.';
        console.error("Erro na rota POST /ai/generate-article (Gemini):", errorMessage, e);
        // Se o erro for por bloqueio de conteúdo, pode ter uma mensagem específica
        const statusCode = errorMessage.includes("bloqueada") ? 400 : 500;
        return c.json<ErrorResponsePayload>({ success: false, error: errorMessage }, statusCode);
    }
});

export default aiRoutes;