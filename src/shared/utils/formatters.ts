/** Formata valor para BRL: R$ 1.234,56 */
export const brl = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

/** Formata data ISO para dd/mm/aaaa */
export const fmt = (s: string): string =>
  s ? new Date(s).toLocaleDateString('pt-BR') : '-'

/** Verifica se já passaram n dias desde a data d */
export const diasPassados = (d: string, n: number): boolean =>
  (Date.now() - new Date(d).getTime()) / 86400000 >= n

/** Converte data ISO para data no fuso de Brasília (UTC-3) */
export function toBRDate(s: string): string {
  const d = new Date(s)
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return br.toISOString().slice(0, 10)
}

/** Retorna data ISO de n dias atrás no fuso de Brasília */
export function daysAgoBR(n: number): string {
  const d = new Date()
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000 - n * 86400000)
  return br.toISOString().slice(0, 10)
}

/** Converte chave 'AAAA-MM-DD' para label 'DD/MM' */
export function keyToLabel(k: string): string {
  return k.slice(8, 10) + '/' + k.slice(5, 7)
}

/** Converte chave 'AAAA-MM-DD' para label 'MM/AA' */
export function keyToMonthLabel(k: string): string {
  return k.slice(5, 7) + '/' + k.slice(2, 4)
}
