// src/types.ts
import { D1Database } from '@cloudflare/workers-types'; // Certifique-se que DB tem um tipo mais específico se possível
import { Plant as DrizzlePlant, NewPlant as DrizzleNewPlant } from './db/schema';

export type Bindings = {
    DB: D1Database; // Ou o tipo específico do seu binding D1
    GEMINI_API_KEY: string; // <--- ALTERADO DE OPENAI_API_KEY
    // Adicione outros bindings aqui se necessário
};

// Usa o tipo Plant inferido pelo Drizzle
export type Plant = DrizzlePlant;
export type NewPlant = DrizzleNewPlant;

export type ErrorResponsePayload = {
    success: boolean;
    error: string;
    details?: string;
};