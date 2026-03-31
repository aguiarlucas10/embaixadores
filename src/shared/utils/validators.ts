/**
 * Validadores para dados de entrada do usuário.
 * Cada função retorna string de erro ou null se válido.
 */

/** Valida CPF (11 dígitos, algoritmo oficial) */
export function validarCPF(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return 'CPF deve ter 11 dígitos'
  if (/^(\d)\1{10}$/.test(digits)) return 'CPF inválido'

  for (let t = 9; t < 11; t++) {
    let sum = 0
    for (let i = 0; i < t; i++) {
      sum += Number(digits[i]) * (t + 1 - i)
    }
    const rem = (sum * 10) % 11
    const check = rem === 10 ? 0 : rem
    if (Number(digits[t]) !== check) return 'CPF inválido'
  }
  return null
}

/** Valida e-mail (formato básico) */
export function validarEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return 'E-mail é obrigatório'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'E-mail inválido'
  return null
}

/** Valida WhatsApp (10-11 dígitos, DDD + número) */
export function validarWhatsApp(fone: string): string | null {
  const digits = fone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 11) return 'WhatsApp deve ter DDD + número (10 ou 11 dígitos)'
  const ddd = Number(digits.slice(0, 2))
  if (ddd < 11 || ddd > 99) return 'DDD inválido'
  return null
}

/** Valida chave Pix (CPF, e-mail, telefone ou chave aleatória) */
export function validarPixKey(pix: string): string | null {
  const trimmed = pix.trim()
  if (!trimmed) return 'Chave Pix é obrigatória'
  // CPF
  if (/^\d{11}$/.test(trimmed.replace(/\D/g, '')) && trimmed.replace(/\D/g, '').length === 11) return null
  // CNPJ
  if (/^\d{14}$/.test(trimmed.replace(/\D/g, '')) && trimmed.replace(/\D/g, '').length === 14) return null
  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  // Telefone (+55...)
  if (/^\+?\d{10,13}$/.test(trimmed.replace(/\D/g, ''))) return null
  // Chave aleatória (UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return null
  return 'Chave Pix inválida (use CPF, e-mail, telefone ou chave aleatória)'
}

/** Valida nome (mínimo 2 palavras, sem caracteres estranhos) */
export function validarNome(nome: string): string | null {
  const trimmed = nome.trim()
  if (trimmed.length < 3) return 'Nome muito curto'
  if (!/^[\p{L}\s'.,-]+$/u.test(trimmed)) return 'Nome contém caracteres inválidos'
  return null
}

/** Sanitiza string removendo tags HTML e caracteres perigosos */
export function sanitize(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

/** Sanitiza um objeto inteiro (apenas valores string) */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      ;(result as Record<string, unknown>)[key] = sanitize(result[key] as string)
    }
  }
  return result
}

/** Valida tamanho e tipo de arquivo para upload */
export function validarArquivo(
  file: File,
  opts: { maxSizeMB?: number; tiposPermitidos?: string[] } = {}
): string | null {
  const { maxSizeMB = 2, tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'] } = opts
  if (!tiposPermitidos.includes(file.type)) {
    return `Tipo não permitido. Use: ${tiposPermitidos.map(t => t.split('/')[1]).join(', ')}`
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `Arquivo muito grande. Máximo: ${maxSizeMB}MB`
  }
  return null
}
