/**
 * Agregadores de saldo da embaixadora a partir das comissões.
 *
 * Saldos:
 *   - pendente: status='pendente' (dentro da janela de devolução)
 *   - confirmado: status='confirmada' AND resgate_id IS NULL (disponível para resgate)
 *   - emResgate: status='confirmada' AND resgate_id NOT NULL (já vinculado a um resgate)
 *   - pago: status='paga' (já pago)
 */

export interface ComissaoForBalance {
  valor_comissao: number | string
  status: string
  resgate_id?: string | null
  resgatada?: boolean | null
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0
}

export function pendente(coms: ComissaoForBalance[]): number {
  return coms.filter((c) => c.status === 'pendente').reduce((s, c) => s + num(c.valor_comissao), 0)
}

export function confirmado(coms: ComissaoForBalance[]): number {
  return coms.filter((c) => c.status === 'confirmada' && !c.resgate_id).reduce((s, c) => s + num(c.valor_comissao), 0)
}

export function emResgate(coms: ComissaoForBalance[]): number {
  return coms.filter((c) => c.status === 'confirmada' && c.resgate_id).reduce((s, c) => s + num(c.valor_comissao), 0)
}

export function pago(coms: ComissaoForBalance[]): number {
  return coms.filter((c) => c.status === 'paga' || c.resgatada).reduce((s, c) => s + num(c.valor_comissao), 0)
}
