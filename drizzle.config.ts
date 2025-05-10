// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/schema.ts', // Caminho para o seu arquivo de schema do Drizzle
    out: './migrations-drizzle',   // Diretório de saída para migrações geradas pelo Drizzle (opcional se você continuar usando wrangler para migrações SQL manuais)
    driver: 'd1',                  // Especifica que estamos usando o driver para Cloudflare D1
    dbCredentials: {
        wranglerConfigPath: './wrangler.jsonc', // Caminho para o seu wrangler.jsonc
        dbName: 'api-floragen-db',              // O nome do binding do seu banco D1 em wrangler.jsonc
    },
    verbose: true, // Opcional: para mais logs do drizzle-kit
    strict: true,  // Opcional: para verificações mais rigorosas
} satisfies Config;