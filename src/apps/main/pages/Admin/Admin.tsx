import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, fetchAll } from '@shared/services/supabase'
import { NS } from '@shared/services/nuvemshopApi'
import { approveWithdrawal, rejectWithdrawal, markWithdrawalPaid } from '@shared/services/withdrawal'
import { uploadPaymentProof } from '@shared/services/storage'
import { brl, fmt, diasPassados, toBRDate, daysAgoBR, keyToLabel, keyToMonthLabel } from '@shared/utils/formatters'
import type { Embaixador, Resgate } from '@shared/types/database'
import { Header } from '@shared/components/layout/Header/Header'
import { Tabs } from '@shared/components/layout/Tabs/Tabs'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { Badge } from '@shared/components/atoms/Badge/Badge'
import { BtnPrimary, BtnSecondary, BtnGhost } from '@shared/components/atoms/Button/Button'
import { Input } from '@shared/components/atoms/Input/Input'
import { BarChartSVG } from '@shared/components/charts/BarChartSVG/BarChartSVG'
import { ComboChartSVG } from '@shared/components/charts/ComboChartSVG/ComboChartSVG'
import { ChatTab } from './tabs/Chat/ChatTab'
import { WhatsAppTab } from './tabs/WhatsApp/WhatsAppTab'
import styles from './Admin.module.css'

const COMISSAO_PCT = Number(import.meta.env['VITE_COMISSAO_PCT'] ?? 0.1)
const JANELA_DEVOLUCAO = Number(import.meta.env['VITE_JANELA_DEVOLUCAO'] ?? 7)

interface AdminPageProps {
  user: User
  onLogout: () => void
}

interface EmbComissoes extends Embaixador {
  comissoes?: { valor_comissao: number; status: string; payment_status?: string; resgatada: boolean }[]
}

interface ResgateComEmb extends Resgate {
  embaixadores?: { nome: string; email: string; cupom: string; pix_key: string }
}

interface FilaItem {
  id: string
  nome: string
  whatsapp: string
  cupom: string
  motivo: string
  p: string
}

interface DashData {
  timeline: Array<{ data: string; dataISO: string; fat: number; comissao: number; cadastros: number; visitas: number }>
  totalFat: number
  totalCom: number
  totalPed: number
  ticketMedio: number
  ativas: number
  comVenda: number
  txConversao: number
  visitasTotal: number
  cadPeriodo: number
  funil: Array<{ etapa: string; valor: number; pct: number }>
  top10: Array<{ id: string; nome: string; fat: number; peds: number; com: number }>
  resgPorMes: Array<{ mes: string; valor: number; qtd: number }>
  porDispositivo: Array<{ label: string; qtd: number }>
  porSO: Array<{ label: string; qtd: number }>
  porNavegador: Array<{ label: string; qtd: number }>
  porUtmSource: Array<{ label: string; qtd: number }>
  porUtmCampaign: Array<{ label: string; qtd: number }>
  funilComportamental: Array<{ etapa: string; qtd: number; pct: number }>
  tempoMedio: number | null
}

interface Msg { text: string; ok: boolean }
type SyncState = false | 'running' | 'done'

export function AdminPage({ user, onLogout }: AdminPageProps) {
  const [embs, setEmbs] = useState<EmbComissoes[]>([])
  const [ress, setRess] = useState<ResgateComEmb[]>([])
  const [todosResgates, setTodosResgates] = useState<ResgateComEmb[]>([])
  const [fila, setFila] = useState<FilaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [busca, setBusca] = useState('')
  const [ordemEmb, setOrdemEmb] = useState('data')
  const [editEmb, setEditEmb] = useState<EmbComissoes | null>(null)
  const [unread, setUnread] = useState(0)
  const [editForm, setEditForm] = useState<Partial<Embaixador>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [msgEdit, setMsgEdit] = useState<Msg>({ text: '', ok: false })
  const [dash, setDash] = useState<DashData | null>(null)
  const [dashPeriodo, setDashPeriodo] = useState(30)
  const [dashModo, setDashModo] = useState('preset')
  const [dashCustomDe, setDashCustomDe] = useState('')
  const [dashCustomAte, setDashCustomAte] = useState('')
  const [banner, setBanner] = useState('')
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [bannerCaption, setBannerCaption] = useState('')
  const [salvandoCaption, setSalvandoCaption] = useState(false)
  const [bannerAltura, setBannerAltura] = useState(200)
  const [salvandoAltura, setSalvandoAltura] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [msgBanner, setMsgBanner] = useState<Msg>({ text: '', ok: false })
  const [grupoLinkAdmin, setGrupoLinkAdmin] = useState('')
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)
  const [msgGrupo, setMsgGrupo] = useState<Msg>({ text: '', ok: false })
  const [syncAdmin, setSyncAdmin] = useState<SyncState>(false)
  const [syncLog, setSyncLog] = useState({ total: 0, novas: 0, erros: 0, atual: '' })
  const [embPage, setEmbPage] = useState(0)
  const [embTotal, setEmbTotal] = useState(0)
  const [embLoading, setEmbLoading] = useState(false)
  const [exportandoCSV, setExportandoCSV] = useState(false)
  const EMB_PAGE_SIZE = 50

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pagina embaixadores server-side (substitui o SELECT * antigo que travava com 1.500+ cadastros)
  useEffect(() => {
    const t = setTimeout(() => { loadEmbs(0, busca); setEmbPage(0) }, 300)
    return () => clearTimeout(t)
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadEmbs(embPage, busca) }, [embPage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dashModo === 'preset') loadDashboard(dashPeriodo, null, null)
    else if (dashCustomDe && dashCustomAte) loadDashboard(null, dashCustomDe, dashCustomAte)
  }, [dashPeriodo, dashModo, dashCustomDe, dashCustomAte]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime unread messages badge
  useEffect(() => {
    supabase.from('mensagens_whatsapp').select('id', { count: 'exact' }).eq('lida', false).eq('de_nos', false)
      .then(({ count }) => setUnread(count ?? 0))
    const ch = supabase.channel('unread').on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_whatsapp' }, () => {
      supabase.from('mensagens_whatsapp').select('id', { count: 'exact' }).eq('lida', false).eq('de_nos', false)
        .then(({ count }) => setUnread(count ?? 0))
    }).subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [])

  async function loadEmbs(page: number, search: string) {
    setEmbLoading(true)
    let q = supabase.from('embaixadores')
      .select('*, comissoes(valor_comissao,status,resgatada,payment_status)', { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(page * EMB_PAGE_SIZE, page * EMB_PAGE_SIZE + EMB_PAGE_SIZE - 1)
    if (search.trim()) {
      const s = `%${search.trim()}%`
      q = q.or(`nome.ilike.${s},email.ilike.${s},cupom.ilike.${s}`)
    }
    const { data, count } = await q
    setEmbs((data as EmbComissoes[]) ?? [])
    setEmbTotal(count ?? 0)
    setEmbLoading(false)
  }

  async function load() {
    setLoading(true)
    const { data: r } = await supabase.from('resgates').select('*, embaixadores(nome,email,cupom,pix_key)').in('status', ['pendente', 'solicitado', 'aprovado']).order('criado_em', { ascending: false })
    setRess((r as ResgateComEmb[]) ?? [])
    const ontem = new Date(Date.now() - 86400000).toISOString()
    const { data: novos } = await supabase.from('embaixadores').select('id,nome,whatsapp,cupom,criado_em').gte('criado_em', ontem)
    const t30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: inat } = await supabase.from('embaixadores').select('id,nome,whatsapp,cupom').lt('criado_em', t30).eq('status', 'ativo')
    setFila([
      ...(novos ?? []).map((x) => ({ ...x, motivo: 'Novo cadastro — boas-vindas', p: 'alta' })),
      ...(inat ?? []).map((x) => ({ ...x, motivo: 'Inativo +30d — reengajar', p: 'media' })),
    ] as FilaItem[])
    const { data: todosR } = await supabase.from('resgates').select('*, embaixadores(nome,email,cupom,pix_key)').order('criado_em', { ascending: false })
    setTodosResgates((todosR as ResgateComEmb[]) ?? [])
    setLoading(false)
    const { data: b } = await supabase.from('config').select('valor').eq('chave', 'banner_ativo').maybeSingle()
    if (b?.valor) setBanner(b.valor)
    const { data: bc } = await supabase.from('config').select('valor').eq('chave', 'banner_caption').maybeSingle()
    setBannerCaption(bc?.valor ?? '')
    const { data: ba } = await supabase.from('config').select('valor').eq('chave', 'banner_altura').maybeSingle()
    if (ba?.valor) setBannerAltura(Number(ba.valor))
    const { data: gl } = await supabase.from('config').select('valor').eq('chave', 'grupo_vip_link').maybeSingle()
    if (gl?.valor) setGrupoLinkAdmin(gl.valor)
  }

  async function sincronizarTodos() {
    if (syncAdmin === 'running') return
    setSyncAdmin('running')
    setSyncLog({ total: 0, novas: 0, erros: 0, atual: 'Buscando pedidos...' })
    try {
      const DATA_MINIMA = '2026-01-01T00:00:00-03:00'
      const { data: cfgSync } = await supabase.from('config').select('valor').eq('chave', 'ultima_sync').maybeSingle()
      const since = cfgSync?.valor && cfgSync.valor > DATA_MINIMA ? cfgSync.valor : DATA_MINIMA
      setSyncLog((l) => ({ ...l, atual: 'Buscando pedidos desde ' + since.slice(0, 10) + '...' }))
      const pedidos = await NS.ordersSince(since)
      setSyncLog((l) => ({ ...l, total: pedidos.length, atual: 'Processando ' + pedidos.length + ' pedidos...' }))
      if (!pedidos.length) {
        setSyncLog((l) => ({ ...l, atual: 'Nenhum pedido novo encontrado.' }))
        setSyncAdmin('done')
        return
      }
      const { data: embsSync } = await supabase.from('embaixadores').select('id,cupom').eq('status', 'ativo')
      const cupomMap: Record<string, string> = {}
      ;(embsSync ?? []).forEach((e) => { if (e.cupom) cupomMap[e.cupom.toUpperCase()] = e.id })
      let novas = 0, erros = 0
      for (let i = 0; i < pedidos.length; i++) {
        const p = pedidos[i]
        setSyncLog((l) => ({ ...l, atual: `(${i + 1}/${pedidos.length}) Pedido #${p.id}` }))
        try {
          const pExt = p as unknown as { coupon?: { code: string }[] }
          const cupomUsado = (pExt.coupon ?? []).map((c) => String(c.code ?? '').toUpperCase()).find((c) => c.startsWith('SGB'))
          if (!cupomUsado) continue
          const embId = cupomMap[cupomUsado]
          if (!embId) continue
          if (p.payment_status === 'voided' || p.payment_status === 'refunded') continue
          const { data: ex } = await supabase.from('comissoes').select('id').eq('pedido_id', String(p.id)).maybeSingle()
          if (ex) continue
          const val = parseFloat(p.total)
          const status = p.payment_status === 'paid' ? (diasPassados(p.created_at, JANELA_DEVOLUCAO) ? 'confirmada' : 'pendente') : 'pendente'
          const { error } = await supabase.from('comissoes').insert({
            embaixador_id: embId, pedido_id: String(p.id),
            valor_pedido: val, valor_comissao: val * COMISSAO_PCT,
            status, payment_status: p.payment_status, criado_em: p.created_at,
          })
          if (!error) novas++
        } catch { erros++ }
        setSyncLog((l) => ({ ...l, novas, erros }))
      }
      await supabase.from('config').upsert({ chave: 'ultima_sync', valor: new Date().toISOString() }, { onConflict: 'chave' })
      setSyncLog((l) => ({ ...l, atual: 'Concluído!' }))
    } catch (e) {
      setSyncLog((l) => ({ ...l, atual: 'Erro: ' + String(e) }))
    }
    setSyncAdmin('done')
    if (dashModo === 'preset') loadDashboard(dashPeriodo, null, null)
    else if (dashCustomDe && dashCustomAte) loadDashboard(null, dashCustomDe, dashCustomAte)
  }

  async function aprovar(id: string) {
    const r = await approveWithdrawal({ resgate_id: id })
    if (!r.ok) { alert(r.message ?? r.error ?? 'Erro ao aprovar'); return }
    await load()
  }
  async function recusar(id: string) {
    const motivo = prompt('Motivo da rejeição (opcional):') ?? undefined
    const r = await rejectWithdrawal({ resgate_id: id, notes: motivo })
    if (!r.ok) { alert(r.message ?? r.error ?? 'Erro ao rejeitar'); return }
    await load()
  }
  async function pagar(id: string) {
    const useFile = confirm('Quer anexar comprovante de pagamento? OK = anexar, Cancelar = só marcar como pago.')
    let proofUrl: string | undefined
    if (useFile) {
      const inp = document.createElement('input')
      inp.type = 'file'
      inp.accept = 'image/*,application/pdf'
      const file: File | null = await new Promise((resolve) => {
        inp.onchange = () => resolve(inp.files?.[0] ?? null)
        inp.click()
      })
      if (file) {
        const up = await uploadPaymentProof(id, file)
        if (!up.ok) { alert('Erro no upload do comprovante: ' + up.error); return }
        proofUrl = up.path
      }
    }
    const r = await markWithdrawalPaid({ resgate_id: id, payment_proof_url: proofUrl })
    if (!r.ok) { alert(r.message ?? r.error ?? 'Erro ao marcar como pago'); return }
    await load()
  }
  async function feito(id: string) {
    await supabase.from('embaixadores').update({ ultima_atividade: new Date().toISOString() }).eq('id', id)
    setFila((f) => f.filter((x) => x.id !== id))
  }

  async function loadDashboard(dias: number | null, customDe: string | null, customAte: string | null) {
    let desdeISO: string, ateISO: string
    if (customDe && customAte) { desdeISO = customDe; ateISO = customAte }
    else { desdeISO = daysAgoBR(dias ?? 30); ateISO = daysAgoBR(0) }
    const desde = desdeISO + 'T00:00:00-03:00'
    const ate = ateISO + 'T23:59:59-03:00'
    const msRange = new Date(ateISO).getTime() - new Date(desdeISO).getTime()
    const diasRange = Math.round(msRange / 86400000) + 1
    const coms = await fetchAll<{ embaixador_id: string | null; valor_pedido: number | null; valor_comissao: number | null; status: string | null; payment_status: string | null; criado_em: string }>(
      (from, to) => supabase.from('comissoes').select('embaixador_id,valor_pedido,valor_comissao,status,payment_status,criado_em').gte('criado_em', desde).lte('criado_em', ate).order('criado_em', { ascending: true }).range(from, to)
    )
    const todosEmbs = await fetchAll<{ id: string; nome: string; status: string; criado_em: string }>(
      (from, to) => supabase.from('embaixadores').select('id,nome,status,criado_em').range(from, to)
    )
    const resgAll = await fetchAll<{ valor: number | null; status: string | null; criado_em: string }>(
      (from, to) => supabase.from('resgates').select('valor,status,criado_em').order('criado_em', { ascending: true }).range(from, to)
    )
    const views = await fetchAll<{ criado_em: string; dispositivo: string | null; sistema_operacional: string | null; navegador: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; etapa_saida: string | null; tempo_segundos: number | null }>(
      (from, to) => supabase.from('page_views').select('criado_em,dispositivo,sistema_operacional,navegador,utm_source,utm_medium,utm_campaign,etapa_saida,tempo_segundos').gte('criado_em', desde).lte('criado_em', ate).range(from, to)
    )
    const fatDiario: Record<string, { faturamento: number; comissao: number }> = {}
    const cadDiario: Record<string, { cadastros: number; visitas: number }> = {}
    for (let d = 0; d < diasRange; d++) {
      const dt = new Date(new Date(desdeISO).getTime() + d * 86400000)
      const key = dt.toISOString().slice(0, 10)
      fatDiario[key] = { faturamento: 0, comissao: 0 }
      cadDiario[key] = { cadastros: 0, visitas: 0 }
    }
    // Vendas válidas = todas exceto canceladas/reembolsadas (inclui pendentes)
    const validas = coms.filter((c) => c.payment_status !== 'voided' && c.payment_status !== 'refunded' && c.payment_status !== 'cancelled')
    validas.forEach((c) => { const k = toBRDate(c.criado_em); if (fatDiario[k]) { fatDiario[k].faturamento += c.valor_pedido ?? 0; fatDiario[k].comissao += c.valor_comissao ?? 0 } })
    todosEmbs.filter((e) => e.criado_em >= desde).forEach((e) => { const k = toBRDate(e.criado_em); if (cadDiario[k]) cadDiario[k].cadastros += 1 })
    views.forEach((v) => { const k = toBRDate(v.criado_em); if (cadDiario[k]) cadDiario[k].visitas += 1 })
    const timeline = Object.keys(fatDiario).sort().map((k) => ({
      data: keyToLabel(k), dataISO: k,
      fat: Math.round(fatDiario[k].faturamento * 100) / 100,
      comissao: Math.round(fatDiario[k].comissao * 100) / 100,
      cadastros: cadDiario[k]?.cadastros ?? 0,
      visitas: cadDiario[k]?.visitas ?? 0,
    }))
    const totalFat = validas.reduce((s, c) => s + (c.valor_pedido ?? 0), 0)
    const totalCom = validas.reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
    const totalPed = validas.length
    const ticketMedio = totalPed > 0 ? totalFat / totalPed : 0
    const ativas = todosEmbs.filter((e) => e.status === 'ativo').length
    const comVenda = new Set(validas.map((c) => c.embaixador_id).filter(Boolean)).size
    const visitasTotal = views.length
    const cadPeriodo = todosEmbs.filter((e) => toBRDate(e.criado_em) >= desdeISO && toBRDate(e.criado_em) <= ateISO).length
    const txConversao = visitasTotal > 0 ? Math.round((cadPeriodo / visitasTotal) * 100) : 0
    const funil = [
      { etapa: 'Visitas', valor: visitasTotal, pct: 100 },
      { etapa: 'Cadastros', valor: cadPeriodo, pct: visitasTotal > 0 ? Math.round((cadPeriodo / visitasTotal) * 100) : 0 },
      { etapa: '1ª venda', valor: comVenda, pct: cadPeriodo > 0 ? Math.round((comVenda / cadPeriodo) * 100) : 0 },
    ]
    const rankMap: Record<string, { id: string; fat: number; peds: number; com: number }> = {}
    validas.forEach((c) => {
      if (!c.embaixador_id) return
      if (!rankMap[c.embaixador_id]) rankMap[c.embaixador_id] = { id: c.embaixador_id, fat: 0, peds: 0, com: 0 }
      rankMap[c.embaixador_id].fat += c.valor_pedido ?? 0
      rankMap[c.embaixador_id].peds += 1
      rankMap[c.embaixador_id].com += c.valor_comissao ?? 0
    })
    const embMap: Record<string, string> = {}
    todosEmbs.forEach((e) => { embMap[e.id] = e.nome })
    const top10 = Object.values(rankMap).sort((a, b) => b.fat - a.fat).slice(0, 10).map((r) => ({ ...r, nome: (embMap[r.id] ?? '?').split(' ').slice(0, 2).join(' ') }))
    const resgMap: Record<string, { mes: string; valor: number; qtd: number }> = {}
    resgAll.forEach((r) => {
      const k = toBRDate(r.criado_em).slice(0, 7)
      if (!resgMap[k]) resgMap[k] = { mes: keyToMonthLabel(k + '-01'), valor: 0, qtd: 0 }
      resgMap[k].valor += r.valor ?? 0; resgMap[k].qtd += 1
    })
    const resgPorMes = Object.values(resgMap).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6)
    function contarPor(arr: Record<string, unknown>[], campo: string) {
      const m: Record<string, number> = {}
      arr.forEach((v) => { const k = String(v[campo] ?? 'desconhecido'); m[k] = (m[k] ?? 0) + 1 })
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, qtd]) => ({ label, qtd }))
    }
    const viewsArr = views as unknown as Record<string, unknown>[]
    const etapaSaida = { form: 0, cupom: 0, sucesso: 0, outros: 0 }
    viewsArr.forEach((v) => {
      const e = v['etapa_saida']
      if (e === 'form') etapaSaida.form++
      else if (e === 'cupom') etapaSaida.cupom++
      else if (e === 'sucesso') etapaSaida.sucesso++
      else etapaSaida.outros++
    })
    const funilComportamental = [
      { etapa: 'Saiu no form', qtd: etapaSaida.form, pct: visitasTotal > 0 ? Math.round((etapaSaida.form / visitasTotal) * 100) : 0 },
      { etapa: 'Saiu no cupom', qtd: etapaSaida.cupom, pct: visitasTotal > 0 ? Math.round((etapaSaida.cupom / visitasTotal) * 100) : 0 },
      { etapa: 'Completou', qtd: etapaSaida.sucesso, pct: visitasTotal > 0 ? Math.round((etapaSaida.sucesso / visitasTotal) * 100) : 0 },
    ]
    const tempos = viewsArr.filter((v) => Number(v['tempo_segundos']) > 0).map((v) => Number(v['tempo_segundos']))
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((s, v) => s + v, 0) / tempos.length) : null
    setDash({ timeline, totalFat, totalCom, totalPed, ticketMedio, ativas, comVenda, txConversao, visitasTotal, cadPeriodo, funil, top10, resgPorMes, porDispositivo: contarPor(viewsArr, 'dispositivo'), porSO: contarPor(viewsArr, 'sistema_operacional'), porNavegador: contarPor(viewsArr, 'navegador'), porUtmSource: contarPor(viewsArr.filter((v) => v['utm_source']), 'utm_source'), porUtmCampaign: contarPor(viewsArr.filter((v) => v['utm_campaign']), 'utm_campaign'), funilComportamental, tempoMedio })
  }

  async function salvarBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { validarArquivo } = await import('@shared/utils/validators')
    const erroArquivo = validarArquivo(file, { maxSizeMB: 2, tiposPermitidos: ['image/jpeg', 'image/png', 'image/webp'] })
    if (erroArquivo) { setMsgBanner({ text: erroArquivo, ok: false }); return }
    const reader = new FileReader()
    reader.onload = (ev) => setBannerPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadando(true); setMsgBanner({ text: '', ok: false })
    try {
      const ext = file.name.split('.').pop()
      const path = `banners/banner_ativo.${ext}`
      const { uploadBanner } = await import('@shared/services/storageProxy')
      const result = await uploadBanner(file, 'assets', path)
      if ('error' in result) { setMsgBanner({ text: result.error, ok: false }); setUploadando(false); return }
      await supabase.from('config').upsert({ chave: 'banner_ativo', valor: result.url }, { onConflict: 'chave' })
      setBanner(result.url); setBannerPreview(null)
      setMsgBanner({ text: 'Banner atualizado com sucesso!', ok: true })
    } catch (err) { setMsgBanner({ text: 'Erro inesperado: ' + String(err), ok: false }) }
    setUploadando(false)
  }

  async function salvarBannerCaption() {
    setSalvandoCaption(true)
    const { error } = await supabase.from('config').upsert({ chave: 'banner_caption', valor: bannerCaption || '' }, { onConflict: 'chave' })
    setSalvandoCaption(false)
    if (error) { setMsgBanner({ text: 'Erro ao salvar legenda: ' + error.message, ok: false }); return }
    setMsgBanner({ text: 'Mensagem salva com sucesso!', ok: true })
  }

  async function salvarAltura() {
    setSalvandoAltura(true)
    const { error } = await supabase.from('config').upsert({ chave: 'banner_altura', valor: String(bannerAltura) }, { onConflict: 'chave' })
    setSalvandoAltura(false)
    if (error) { setMsgBanner({ text: 'Erro ao salvar altura: ' + error.message, ok: false }); return }
    setMsgBanner({ text: 'Altura salva!', ok: true })
  }

  async function removerBanner() {
    const { error } = await supabase.from('config').upsert({ chave: 'banner_ativo', valor: '' }, { onConflict: 'chave' })
    if (error) { setMsgBanner({ text: 'Erro ao remover banner: ' + error.message, ok: false }); return }
    setBanner(''); setBannerPreview(null); setMsgBanner({ text: 'Banner removido.', ok: true })
  }

  async function salvarGrupoLink() {
    setSalvandoGrupo(true); setMsgGrupo({ text: '', ok: false })
    const { error } = await supabase.from('config').upsert({ chave: 'grupo_vip_link', valor: grupoLinkAdmin }, { onConflict: 'chave' })
    setSalvandoGrupo(false)
    if (error) { setMsgGrupo({ text: 'Erro ao salvar link: ' + error.message, ok: false }); return }
    setMsgGrupo({ text: 'Link salvo com sucesso!', ok: true })
  }

  async function salvarEdicao() {
    if (!editEmb) return
    setSavingEdit(true); setMsgEdit({ text: '', ok: false })
    const { error } = await supabase.from('embaixadores').update({
      nome: editForm.nome, email: editForm.email, whatsapp: editForm.whatsapp,
      instagram: editForm.instagram, tiktok: editForm.tiktok, cupom: editForm.cupom,
      status: editForm.status, nivel: editForm.nivel, pix_key: editForm.pix_key,
    }).eq('id', editEmb.id)
    if (error) { setMsgEdit({ text: 'Erro ao salvar: ' + error.message, ok: false }) }
    else { setMsgEdit({ text: 'Salvo com sucesso!', ok: true }); await loadEmbs(embPage, busca); setEditEmb(null) }
    setSavingEdit(false)
  }

  async function exportarCSV() {
    setExportandoCSV(true)
    try {
      const all: Embaixador[] = []
      const SIZE = 500
      let page = 0
      while (true) {
        const { data } = await supabase.from('embaixadores')
          .select('nome,email,whatsapp,instagram,tiktok,cupom,status,nivel,pix_key,criado_em')
          .order('criado_em', { ascending: false })
          .range(page * SIZE, page * SIZE + SIZE - 1)
        if (!data || data.length === 0) break
        all.push(...(data as Embaixador[]))
        if (data.length < SIZE) break
        page++
      }
      const cols = ['Nome', 'Email', 'WhatsApp', 'Instagram', 'TikTok', 'Cupom', 'Status', 'Nivel', 'Pix', 'Cadastro']
      const lines = [cols.join(','), ...all.map((e) => [e.nome, e.email, e.whatsapp, e.instagram ?? '', e.tiktok ?? '', e.cupom, e.status, e.nivel ?? 'embaixadora', e.pix_key ?? '', fmt(e.criado_em)].map((v) => String(v ?? '').replace(/"/g, '')).join(','))]
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'embaixadores.csv'; a.click(); URL.revokeObjectURL(url)
    } finally {
      setExportandoCSV(false)
    }
  }

  function exportarFinanceiroCSV() {
    const cols = ['Data Solicitacao', 'Nome', 'Email', 'Cupom', 'Chave Pix', 'Tipo', 'Valor', 'Status']
    const lines = [cols.join(','), ...todosResgates.map((r) => {
      const emb = (r.embaixadores ?? {}) as { nome?: string; email?: string; cupom?: string; pix_key?: string }
      return [fmt(r.criado_em), emb.nome ?? '', emb.email ?? '', emb.cupom ?? '', r.pix_key ?? emb.pix_key ?? '', r.tipo === 'pix' ? 'Pix' : 'Credito', String(r.valor ?? '0').replace('.', ','), r.status].map((v) => String(v ?? '').replace(/"/g, '')).join(',')
    })]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resgates_financeiro.csv'; a.click(); URL.revokeObjectURL(url)
  }

  // Busca é server-side (em loadEmbs); aqui só ordena a página atual
  const filtrados = useMemo(() => {
    return [...embs].sort((a, b) => {
      if (ordemEmb === 'nome') return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt')
      if (ordemEmb === 'faturamento') {
        const fa = (a.comissoes ?? []).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        const fb = (b.comissoes ?? []).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        return fb - fa
      }
      if (ordemEmb === 'disponivel') {
        const da = (a.comissoes ?? []).filter((c) => (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        const db = (b.comissoes ?? []).filter((c) => (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        return db - da
      }
      return new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime()
    })
  }, [embs, ordemEmb])

  if (loading) return <div className={styles.page}><Header user={user} onLogout={onLogout} isAdmin /><Spinner /></div>

  const tabLabels = { dashboard: 'Dashboard', embaixadores: `Embaixadores (${embTotal})`, resgates: ress.length > 0 ? `Resgates (${ress.length})` : 'Resgates', fila: `Fila (${fila.length})`, financeiro: 'Financeiro', banner: 'Banner', whatsapp: unread > 0 ? `WhatsApp (${unread})` : 'WhatsApp', chat: unread > 0 ? `Chat (${unread})` : 'Chat', importar: 'Importar', 'pré-estreia': 'Pré-estreia' }

  return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} isAdmin altAppLabel="Embaixadoras SG" altAppHref="/sg" />
      <div className={`admin-wrap fade-in ${styles.wrap}`}>

        {/* Sync controls */}
        <div className={styles.syncBar}>
          <BtnSecondary onClick={sincronizarTodos} style={{ width: 'auto' }}>
            {syncAdmin === 'running' ? <span className={styles.syncSpinner} /> : 'Sincronizar Nuvemshop'}
          </BtnSecondary>
          {syncAdmin !== false && (
            <div className={styles.syncLog}>
              <span className={styles.syncLogText}>{syncLog.atual}</span>
              {syncLog.total > 0 && <span className={styles.syncLogStats}>{syncLog.novas} novas · {syncLog.erros} erros · {syncLog.total} total</span>}
            </div>
          )}
        </div>

        <Tabs
          tabs={['dashboard', 'embaixadores', 'resgates', 'fila', 'financeiro', 'banner', 'whatsapp', 'chat', 'importar', 'pré-estreia']}
          labels={tabLabels}
          active={tab}
          onChange={setTab}
        >
          {/* ─── DASHBOARD ─── */}
          {tab === 'dashboard' && (
            <div className="fade-in">
              {/* Period selector */}
              <div className={styles.periodBar}>
                <div className={styles.presetBtns}>
                  {[7, 15, 30, 90].map((d) => (
                    <button key={d} className={`${styles.presetBtn} ${dashModo === 'preset' && dashPeriodo === d ? styles.presetBtnActive : ''}`}
                      onClick={() => { setDashModo('preset'); setDashPeriodo(d) }}>
                      {d}d
                    </button>
                  ))}
                  <button className={`${styles.presetBtn} ${dashModo === 'custom' ? styles.presetBtnActive : ''}`}
                    onClick={() => setDashModo('custom')}>
                    Período
                  </button>
                </div>
                {dashModo === 'custom' && (
                  <div className={styles.customRange}>
                    <input type="date" value={dashCustomDe} onChange={(e) => setDashCustomDe(e.target.value)} className={styles.dateInput} />
                    <span>até</span>
                    <input type="date" value={dashCustomAte} onChange={(e) => setDashCustomAte(e.target.value)} className={styles.dateInput} />
                  </div>
                )}
              </div>

              {!dash ? <Spinner /> : (
                <div>
                  {/* KPIs */}
                  <div className={styles.kpiGrid}>
                    {([
                      ['Faturamento', brl(dash.totalFat), 'pedidos pagos no período'],
                      ['Comissões', brl(dash.totalCom), 'geradas no período'],
                      ['Pedidos', dash.totalPed, 'com cupom'],
                      ['Ticket médio', brl(dash.ticketMedio), 'por pedido'],
                      ['Ativas', dash.ativas, 'embaixadoras'],
                      ['Com venda', dash.comVenda, 'venderam no período'],
                      ['Visitas LP', dash.visitasTotal, 'acessos à página'],
                      ['Conversão', dash.txConversao + '%', 'visitas → cadastro'],
                    ] as [string, string | number, string][]).map(([label, val, sub]) => (
                      <div key={label} className={styles.kpiCard}>
                        <p className={styles.kpiLabel}>{label}</p>
                        <p className={styles.kpiVal}>{val}</p>
                        <p className={styles.kpiSub}>{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className={styles.chartSection}>
                    <p className={styles.chartTitle}>Faturamento diário</p>
                    <p className={styles.chartSub}>Pedidos pagos (preto) vs comissão gerada (cinza)</p>
                    <BarChartSVG data={dash.timeline} valueKey="fat" secondKey="comissao" secondLabel="Comissão" labelKey="data" isCurrency />
                  </div>

                  <div className={styles.chartSection}>
                    <p className={styles.chartTitle}>Cadastros e visitas diárias</p>
                    <p className={styles.chartSub}>Cadastros (barra) vs visitas (linha)</p>
                    <ComboChartSVG data={dash.timeline} barKey="cadastros" barLabel="Cadastros" lineKey="visitas" lineLabel="Visitas" labelKey="data" />
                  </div>

                  <div className={styles.twoCol}>
                    {/* Funil */}
                    <div>
                      <p className={styles.chartTitle}>Funil de conversão</p>
                      {dash.funil.map((f, i) => (
                        <div key={f.etapa} className={styles.funilItem}>
                          <div className={styles.funilRow}>
                            <span className={styles.funilLabel}>{f.etapa}</span>
                            <span className={styles.funilVal}><strong>{f.valor}</strong> <span className={styles.funilPct}>({f.pct}%)</span></span>
                          </div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: f.pct + '%', background: i === 0 ? '#000' : i === 1 ? '#555' : '#999' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Resgates */}
                    <div>
                      <p className={styles.chartTitle}>Resgates por mês</p>
                      <BarChartSVG data={dash.resgPorMes} valueKey="valor" labelKey="mes" isCurrency />
                    </div>
                  </div>

                  {/* Top embaixadoras */}
                  <div className={styles.chartSection}>
                    <p className={styles.chartTitle}>Top embaixadoras — período</p>
                    {dash.top10.length === 0
                      ? <p className={styles.empty}>Nenhuma venda no período.</p>
                      : dash.top10.map((r, i) => (
                        <div key={r.id ?? i} className={styles.topRow}>
                          <span className={styles.topNum}>{i + 1}</span>
                          <div className={styles.topInfo}>
                            <p className={styles.topNome}>{r.nome}</p>
                            <p className={styles.topSub}>{r.peds} pedido{r.peds !== 1 ? 's' : ''} · {brl(r.com)} de comissão</p>
                          </div>
                          <p className={styles.topFat}>{brl(r.fat)}</p>
                          <div className={styles.topBar}>
                            <div className={styles.topBarFill} style={{ width: Math.round((r.fat / (dash.top10[0]?.fat ?? 1)) * 100) + '%' }} />
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Analytics */}
                  <div className={styles.divider} />
                  <p className={styles.analyticsTitle}>
                    Analytics de audiência
                    {dash.tempoMedio !== null && <span> · Tempo médio na página: <strong>{dash.tempoMedio}s</strong></span>}
                  </p>

                  <div className={styles.chartSection}>
                    <p className={styles.chartTitle}>Onde as pessoas saem</p>
                    {dash.funilComportamental.map((f, i) => {
                      const cores = ['#d44', '#e8a020', '#2a9d5c']
                      return (
                        <div key={f.etapa} className={styles.funilItem}>
                          <div className={styles.funilRow}>
                            <span className={styles.funilLabel}>{f.etapa}</span>
                            <span className={styles.funilVal}>{f.qtd} visitas <strong style={{ color: cores[i] }}>{f.pct}%</strong></span>
                          </div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: f.pct + '%', background: cores[i] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className={styles.threeCol}>
                    {[
                      ['Dispositivo', dash.porDispositivo],
                      ['Sistema operacional', dash.porSO],
                      ['Navegador', dash.porNavegador],
                    ].map(([label, data]) => (
                      <div key={label as string}>
                        <p className={styles.chartTitle}>{label as string}</p>
                        {(data as { label: string; qtd: number }[]).length === 0
                          ? <p className={styles.empty}>Sem dados ainda</p>
                          : (data as { label: string; qtd: number }[]).map(({ label: l, qtd }) => {
                            const pct = dash.visitasTotal > 0 ? Math.round((qtd / dash.visitasTotal) * 100) : 0
                            return (
                              <div key={l} className={styles.funilItem}>
                                <div className={styles.funilRow}>
                                  <span className={styles.funilLabel}>{l}</span>
                                  <span className={styles.funilVal}>{qtd} <strong>{pct}%</strong></span>
                                </div>
                                <div className={styles.progressBar}>
                                  <div className={styles.progressFill} style={{ width: pct + '%' }} />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── EMBAIXADORES ─── */}
          {tab === 'embaixadores' && (
            <div className="fade-in">
              <div className={styles.toolBar}>
                <input className={styles.search} type="text" placeholder="Buscar por nome, e-mail ou cupom..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className={styles.sortBtns}>
                  {[['data', 'Data'], ['nome', 'Nome'], ['faturamento', 'Fat.'], ['disponivel', 'Disp.']].map(([v, l]) => (
                    <button key={v} className={`${styles.sortBtn} ${ordemEmb === v ? styles.sortBtnActive : ''}`} onClick={() => setOrdemEmb(v)}>{l}</button>
                  ))}
                </div>
                <BtnSecondary onClick={exportarCSV} style={{ width: 'auto', padding: '8px 16px', fontSize: 10 }} disabled={exportandoCSV}>
                  {exportandoCSV ? 'Exportando...' : 'Exportar CSV'}
                </BtnSecondary>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 12, color: '#707070' }}>
                <span>
                  {embLoading ? 'Carregando...' : embTotal === 0 ? 'Nenhum resultado' :
                    `${embPage * EMB_PAGE_SIZE + 1}–${Math.min((embPage + 1) * EMB_PAGE_SIZE, embTotal)} de ${embTotal}`}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEmbPage((p) => Math.max(0, p - 1))} disabled={embPage === 0 || embLoading}
                    style={{ padding: '6px 12px', fontSize: 11, background: '#fff', border: '1px solid #d0d0d0', cursor: embPage === 0 || embLoading ? 'not-allowed' : 'pointer', opacity: embPage === 0 || embLoading ? 0.5 : 1 }}>
                    ← Anterior
                  </button>
                  <button onClick={() => setEmbPage((p) => p + 1)} disabled={(embPage + 1) * EMB_PAGE_SIZE >= embTotal || embLoading}
                    style={{ padding: '6px 12px', fontSize: 11, background: '#fff', border: '1px solid #d0d0d0', cursor: (embPage + 1) * EMB_PAGE_SIZE >= embTotal || embLoading ? 'not-allowed' : 'pointer', opacity: (embPage + 1) * EMB_PAGE_SIZE >= embTotal || embLoading ? 0.5 : 1 }}>
                    Próxima →
                  </button>
                </div>
              </div>

              {filtrados.map((e) => {
                const fat = (e.comissoes ?? []).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
                const disp = (e.comissoes ?? []).filter((c) => (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
                return (
                  <div key={e.id} className={styles.embRow}>
                    <div className={styles.embInfo}>
                      <p className={styles.embNome}>{e.nome}</p>
                      <p className={styles.embSub}>{e.email} · {e.whatsapp}</p>
                      <p className={styles.embCupom}>{e.cupom} · {fmt(e.criado_em)}</p>
                    </div>
                    <div className={styles.embStats}>
                      <span className={styles.embStatVal}>{brl(fat)}</span>
                      <span className={styles.embStatLabel}>fat</span>
                      <span className={styles.embStatVal}>{brl(disp)}</span>
                      <span className={styles.embStatLabel}>disp</span>
                    </div>
                    <div className={styles.embBadges}>
                      <Badge text={e.status} color={e.status === 'ativo' ? '#000' : '#a0a0a0'} />
                    </div>
                    <button className={styles.editBtn} onClick={() => { setEditEmb(e); setEditForm({ ...e }); setMsgEdit({ text: '', ok: false }) }}>Editar</button>
                  </div>
                )
              })}

              {/* Edit modal */}
              {editEmb && (
                <div className={styles.modalOverlay} onClick={() => setEditEmb(null)}>
                  <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <p className={styles.modalTitle}>Editar embaixador</p>
                    <div className={styles.modalFields}>
                      {[['nome', 'Nome'], ['email', 'E-mail'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['cupom', 'Cupom'], ['pix_key', 'Chave Pix']].map(([k, l]) => (
                        <Input key={k} label={l} value={String((editForm as Record<string, unknown>)[k] ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))} />
                      ))}
                      <div className={styles.selectWrap}>
                        <label className={styles.selectLabel}>Status</label>
                        <select value={editForm.status ?? 'ativo'} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Embaixador['status'] }))} className={styles.select}>
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                          <option value="pendente">Pendente</option>
                        </select>
                      </div>
                      <div className={styles.selectWrap}>
                        <label className={styles.selectLabel}>Nível</label>
                        <select value={editForm.nivel ?? 'embaixadora'} onChange={(e) => setEditForm((f) => ({ ...f, nivel: e.target.value as Embaixador['nivel'] }))} className={styles.select}>
                          <option value="embaixadora">Embaixadora</option>
                          <option value="influenciadora">Influenciadora</option>
                          <option value="destaque">Destaque</option>
                        </select>
                      </div>
                    </div>
                    {msgEdit.text && <Alert msg={msgEdit.text} ok={msgEdit.ok} />}
                    <div className={styles.modalActions}>
                      <BtnPrimary onClick={salvarEdicao} loading={savingEdit}>Salvar</BtnPrimary>
                      <BtnGhost onClick={() => setEditEmb(null)}>Cancelar</BtnGhost>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── RESGATES ─── */}
          {tab === 'resgates' && (
            <div className="fade-in">
              <p className={styles.sectionTitle}>
                Resgates · {ress.filter((r) => r.status === 'solicitado' || r.status === 'pendente').length} aguardando aprovação · {ress.filter((r) => r.status === 'aprovado').length} aprovados a pagar
              </p>
              {ress.length === 0
                ? <p className={styles.empty}>Nenhuma solicitação aberta.</p>
                : ress.map((r) => {
                  const aguardandoAprov = r.status === 'solicitado' || r.status === 'pendente'
                  const aprovado = r.status === 'aprovado'
                  return (
                  <div key={r.id} className={styles.resgateRow}>
                    <div>
                      <p className={styles.rowTitle}>{r.embaixadores?.nome ?? '—'}</p>
                      <p className={styles.rowSub}>{r.embaixadores?.email} · Pix: {r.pix_key ?? r.embaixadores?.pix_key}{r.pix_key_type ? ` (${r.pix_key_type})` : ''}</p>
                      <p className={styles.rowSub}>Solicitado {fmt(r.criado_em)}{aprovado && r.approved_at ? ` · Aprovado ${fmt(r.approved_at)}` : ''}</p>
                    </div>
                    <div className={styles.resgateActions}>
                      <p className={styles.resgateVal}>{brl(r.valor)}</p>
                      <Badge text={r.status} color={aprovado ? '#000' : '#a0a0a0'} />
                      {aguardandoAprov && (<>
                        <BtnPrimary onClick={() => aprovar(r.id)} style={{ width: 'auto', padding: '8px 16px', fontSize: 10 }}>Aprovar</BtnPrimary>
                        <BtnGhost onClick={() => recusar(r.id)}>Rejeitar</BtnGhost>
                      </>)}
                      {aprovado && (<>
                        <BtnPrimary onClick={() => pagar(r.id)} style={{ width: 'auto', padding: '8px 16px', fontSize: 10 }}>Marcar pago</BtnPrimary>
                        <BtnGhost onClick={() => recusar(r.id)}>Rejeitar</BtnGhost>
                      </>)}
                    </div>
                  </div>
                  )
                })}
            </div>
          )}

          {/* ─── FILA ─── */}
          {tab === 'fila' && (
            <div className="fade-in">
              <p className={styles.sectionTitle}>Fila de contato</p>
              {fila.length === 0
                ? <p className={styles.empty}>Fila vazia.</p>
                : fila.map((f) => (
                  <div key={f.id} className={styles.filaRow}>
                    <div>
                      <p className={styles.rowTitle}>{f.nome}</p>
                      <p className={styles.rowSub}>{f.motivo}</p>
                    </div>
                    <div className={styles.filaActions}>
                      <a href={`https://wa.me/55${f.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={styles.waLink}>WhatsApp →</a>
                      <BtnGhost onClick={() => feito(f.id)}>Feito</BtnGhost>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ─── FINANCEIRO ─── */}
          {tab === 'financeiro' && (
            <div className="fade-in">
              <div className={styles.toolBar}>
                <p className={styles.sectionTitle}>Histórico de resgates</p>
                <BtnSecondary onClick={exportarFinanceiroCSV} style={{ width: 'auto', padding: '8px 16px', fontSize: 10 }}>Exportar CSV</BtnSecondary>
              </div>
              {todosResgates.map((r) => (
                <div key={r.id} className={styles.finRow}>
                  <div>
                    <p className={styles.rowTitle}>{r.embaixadores?.nome ?? '—'}</p>
                    <p className={styles.rowSub}>{r.embaixadores?.cupom} · {r.tipo === 'pix' ? 'Pix: ' + (r.pix_key ?? r.embaixadores?.pix_key) : 'Crédito'}</p>
                    <p className={styles.rowSub}>{fmt(r.criado_em)}</p>
                  </div>
                  <div className={styles.finRight}>
                    <p className={styles.rowValue}>{brl(r.valor)}</p>
                    <Badge text={r.status} color={r.status === 'pago' ? '#000' : r.status === 'recusado' ? '#c00' : '#a0a0a0'} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── BANNER ─── */}
          {tab === 'banner' && (
            <div className="fade-in">
              <div className={`banner-admin-wrap ${styles.bannerSection}`}>
                <p className={styles.sectionTitle}>Banner ativo</p>
                {(banner || bannerPreview) && <img src={bannerPreview ?? banner} alt="Banner" style={{ width: '100%', maxHeight: bannerAltura, objectFit: 'cover', display: 'block', marginBottom: 16 }} />}
                <div className={styles.bannerActions}>
                  <label className={styles.uploadLabel}>
                    {uploadando ? <span className={styles.syncSpinner} /> : 'Enviar imagem'}
                    <input type="file" accept="image/*" onChange={salvarBannerFile} style={{ display: 'none' }} />
                  </label>
                  {banner && <BtnGhost onClick={removerBanner}>Remover banner</BtnGhost>}
                </div>
                <div className={styles.bannerFields}>
                  <Input label="Altura do banner (px)" value={String(bannerAltura)} onChange={(e) => setBannerAltura(Number(e.target.value))} type="number" />
                  <BtnPrimary onClick={salvarAltura} loading={salvandoAltura}>Salvar altura</BtnPrimary>
                </div>
                <div className={styles.bannerFields}>
                  <Input label="Legenda do banner" value={bannerCaption} onChange={(e) => setBannerCaption(e.target.value)} placeholder="Mensagem abaixo do banner (opcional)" />
                  <BtnPrimary onClick={salvarBannerCaption} loading={salvandoCaption}>Salvar legenda</BtnPrimary>
                </div>
                <div className={styles.bannerFields}>
                  <Input label="Link do Grupo VIP WhatsApp" value={grupoLinkAdmin} onChange={(e) => setGrupoLinkAdmin(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                  <BtnPrimary onClick={salvarGrupoLink} loading={salvandoGrupo}>Salvar link</BtnPrimary>
                  {msgGrupo.text && <Alert msg={msgGrupo.text} ok={msgGrupo.ok} />}
                </div>
                {msgBanner.text && <Alert msg={msgBanner.text} ok={msgBanner.ok} />}
              </div>
            </div>
          )}

          {/* ─── IMPORTAR ─── */}
          {tab === 'importar' && (
            <div className="fade-in">
              <p className={styles.sectionTitle}>Importar embaixadores</p>
              <p className={styles.empty}>Funcionalidade disponível no arquivo legado. Em desenvolvimento na nova versão.</p>
            </div>
          )}

          {/* ─── PRÉ-ESTREIA ─── */}
          {tab === 'pré-estreia' && (
            <div className="fade-in">
              <p className={styles.sectionTitle}>Lista pré-estreia</p>
              <p className={styles.empty}>Funcionalidade disponível no arquivo legado. Em desenvolvimento na nova versão.</p>
            </div>
          )}

          {/* ─── WHATSAPP ─── */}
          {tab === 'whatsapp' && <WhatsAppTab embs={embs} />}

          {/* ─── CHAT ─── */}
          {tab === 'chat' && <ChatTab embs={embs} onUnread={setUnread} />}
        </Tabs>
      </div>
    </div>
  )
}
