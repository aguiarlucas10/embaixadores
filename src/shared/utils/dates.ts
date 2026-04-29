/**
 * Helpers de data para a janela de resgate (1-10 do mês, BRT).
 */

const BRT = 'America/Sao_Paulo'

function getDayBRT(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: BRT, day: 'numeric' }).format(d))
}

export function isWithdrawalWindow(d: Date = new Date()): boolean {
  return getDayBRT(d) <= 10
}

export function daysUntilWithdrawalWindow(d: Date = new Date()): number {
  if (isWithdrawalWindow(d)) return 0
  const nowBRT = new Date(d.toLocaleString('en-US', { timeZone: BRT }))
  const nextMonthFirst = new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 1)
  const ms = nextMonthFirst.getTime() - nowBRT.getTime()
  return Math.ceil(ms / 86_400_000)
}

export function nextPaymentDay(d: Date = new Date()): Date {
  const nowBRT = new Date(d.toLocaleString('en-US', { timeZone: BRT }))
  const day = nowBRT.getDate()
  if (day <= 20) return new Date(nowBRT.getFullYear(), nowBRT.getMonth(), 20)
  return new Date(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 20)
}
