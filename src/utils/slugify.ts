// src/utils/slugify.ts

/**
 * Converte uma string em um slug amigável para URLs.
 * - Transforma para minúsculas
 * - Remove acentos e caracteres especiais
 * - Substitui espaços e múltiplos hifens por um único hifen
 * - Remove hifens no início e no fim
 * @param text A string a ser convertida.
 * @returns O slug gerado.
 */
export function slugify(text: string): string {
    const from = "áàäâãåăąçćčđďèéěëêęǵḧîïíīįìłḿǹńôöòóœøōõőṕŕřßſśšșťțûüùúūǘůűųẃẍÿýžźż·/_,:;"
    const to = "aaaaaaaaacccddeeeeeeghiiiiiilmnnoooooooooprrssssttuuuuuuuuuwxyyzzz------"

    let slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-') // Substitui espaços por hifens
        .replace(/[^\w-]+/g, '') // Remove todos os caracteres não alfanuméricos exceto hifens
        .replace(/-+/g, '-') // Substitui múltiplos hifens por um único hifen
        .replace(/^-+/, '') // Remove hifens do início
        .replace(/-+$/, ''); // Remove hifens do fim

    // Remover acentos - itera sobre os caracteres acentuados e substitui
    for (let i = 0, l = from.length; i < l; i++) {
        slug = slug.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }


    return slug;
}