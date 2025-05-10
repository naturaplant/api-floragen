// src/db/schema.ts
import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Define a tabela 'plants' usando a sintaxe do Drizzle
export const plantsTable = sqliteTable('plants', {
    id: integer('id').primaryKey({ autoIncrement: true }), // Drizzle normalmente infere autoIncrement para INTEGER PRIMARY KEY no SQLite
    name: text('name').notNull(),
    language: text('language').notNull(),
    scientific_name: text('scientific_name'), // Pode ser nulo
    title: text('title'),                     // Pode ser nulo
    brief_description: text('brief_description'), // Pode ser nulo
    content: text('content'),                 // Pode ser nulo
    slug: text('slug').notNull(),
}, (table) => {
    // Definindo a constraint UNIQUE composta para 'slug' e 'language'
    return {
        slugLanguageUniqueIdx: uniqueIndex('slug_language_unique_idx').on(table.slug, table.language),
    };
});

// Inferir tipos TypeScript a partir do schema da tabela 'plants'
// Para resultados de SELECT
export type Plant = InferSelectModel<typeof plantsTable>;
// Para payloads de INSERT (útil para dados de criação)
export type NewPlant = InferInsertModel<typeof plantsTable>;
// Para payloads de UPDATE, podemos criar um tipo parcial se necessário, ou usar NewPlant e tornar campos opcionais
// export type UpdatePlantPayload = Partial<Omit<NewPlant, 'id'>>; // Exemplo