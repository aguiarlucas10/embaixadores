/**
 * Gera a base do cupom a partir do nome do embaixador.
 * Ex: "Ana Paula" → "SGBANAPAULÂ" → "SGBANAPAULA"
 */
export const gerarCupomBase = (nome: string): string =>
  'SGB' +
  nome
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 9)

/**
 * Gera cupom completo com sufixo numérico opcional para deduplicação.
 * Total máximo de 12 caracteres.
 * Ex: gerarCupom("Ana Paula", 2) → "SGBANAPAU2"
 */
export const gerarCupom = (nome: string, sufixo: number | string = ''): string => {
  const base = gerarCupomBase(nome)
  if (!sufixo) return base
  return base.slice(0, 12 - String(sufixo).length) + sufixo
}
