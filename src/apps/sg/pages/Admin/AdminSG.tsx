import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@shared/services/supabase'
import { brl, fmt, toBRDate, daysAgoBR, keyToLabel, keyToMonthLabel } from '@shared/utils/formatters'
import type { EmbaixadorSG, ResgateSG } from '@shared/types/database'
import { Header } from '@shared/components/layout/Header/Header'
import { Tabs } from '@shared/components/layout/Tabs/Tabs'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { Badge } from '@shared/components/atoms/Badge/Badge'
import { BtnPrimary, BtnSecondary } from '@shared/components/atoms/Button/Button'
import { Input } from '@shared/components/atoms/Input/Input'
import { BarChartSVG } from '@shared/components/charts/BarChartSVG/BarChartSVG'
import styles from './AdminSG.module.css'

interface AdminSGProps {
  user: User
  onLogout: () => void
}

interface EmbComissoesSG extends EmbaixadorSG {
  comissoes_sg?: { valor_comissao: number; status: string; payment_status: string; resgatada: boolean }[]
}

interface ResgateComEmbSG extends ResgateSG {
  embaixadores_sg?: { nome: string; email: string; cupom: string; pix_key: string }
}

interface DashData {
  timeline: { data: string; fat: number; comissao: number; cadastros: number }[]
  resgPorMes: { mes: string; valor: number; qtd: number }[]
  totalFat: number; totalCom: number; totalPed: number; ticketMedio: number
  ativas: number; comVenda: number; cadPeriodo: number
  top10: { id: string; nome: string; fat: number; peds: number; com: number }[]
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', embaixadoras: 'Embaixadoras', resgates: 'Resgates',
  financeiro: 'Financeiro', fila: 'Fila', ranking: 'Ranking',
  banner: 'Banner', whatsapp: 'WhatsApp', chat: 'Chat',
  importar: 'Importar', estreia: 'Pré-estreia',
}
const TABS = Object.keys(TAB_LABELS)

export function PageAdminSG({ user, onLogout }: AdminSGProps) {
  const [tab, setTab] = useState('dashboard')
  const [embs, setEmbs] = useState<EmbComissoesSG[]>([])
  const [ress, setRess] = useState<ResgateComEmbSG[]>([])
  const [todosResgates, setTodosResgates] = useState<ResgateComEmbSG[]>([])
  const [fila, setFila] = useState<{ id: string; nome: string; whatsapp: string; cupom: string; motivo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordemEmb, setOrdemEmb] = useState('data')
  const [editEmb, setEditEmb] = useState<EmbaixadorSG | null>(null)
  const [editForm, setEditForm] = useState<Partial<EmbaixadorSG>>({})
  const [msgEdit, setMsgEdit] = useState({ text: '', ok: false })
  const [savingEdit, setSavingEdit] = useState(false)
  const [banner, setBanner] = useState('')
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [bannerCaption, setBannerCaption] = useState('')
  const [bannerAltura, setBannerAltura] = useState(200)
  const [uploadando, setUploadando] = useState(false)
  const [salvandoCaption, setSalvandoCaption] = useState(false)
  const [salvandoAltura, setSalvandoAltura] = useState(false)
  const [msgBanner, setMsgBanner] = useState({ text: '', ok: false })
  const [dash, setDash] = useState<DashData | null>(null)
  const [dashPeriodo, setDashPeriodo] = useState(30)
  const [dashModo, setDashModo] = useState<'preset' | 'custom'>('preset')
  const [dashCustomDe, setDashCustomDe] = useState('')
  const [dashCustomAte, setDashCustomAte] = useState('')
  // CSV import
  const [csvLinhas, setCsvLinhas] = useState<Partial<EmbaixadorSG>[]>([])
  const [csvErro, setCsvErro] = useState('')
  const [importando, setImportando] = useState(false)
  const [msgImport, setMsgImport] = useState({ text: '', ok: false })

  const filtrados = useMemo(() => {
    const base = embs.filter((e) =>
      !busca || [e.nome, e.email, e.cupom].join(' ').toLowerCase().includes(busca.toLowerCase())
    )
    return [...base].sort((a, b) => {
      if (ordemEmb === 'nome') return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt')
      const coms = (x: EmbComissoesSG) => x.comissoes_sg ?? []
      if (ordemEmb === 'faturamento') {
        const fa = coms(a).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        const fb = coms(b).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        return fb - fa
      }
      if (ordemEmb === 'disponivel') {
        const valid = (c: { status: string; payment_status: string; resgatada: boolean }) =>
          (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada
        const da = coms(a).filter(valid).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        const db = coms(b).filter(valid).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
        return db - da
      }
      return new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime()
    })
  }, [embs, busca, ordemEmb])

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (dashModo === 'preset') loadDashboard(dashPeriodo, null, null)
    else if (dashCustomDe && dashCustomAte) loadDashboard(null, dashCustomDe, dashCustomAte)
  }, [dashPeriodo, dashModo, dashCustomDe, dashCustomAte])

  async function load() {
    setLoading(true)
    const { data: e } = await supabase.from('embaixadores_sg')
      .select('*, comissoes_sg(valor_comissao,status,payment_status,resgatada)')
      .order('criado_em', { ascending: false })
    setEmbs((e ?? []) as EmbComissoesSG[])

    const { data: r } = await supabase.from('resgates_sg')
      .select('*, embaixadores_sg(nome,email,cupom,pix_key)')
      .eq('status', 'solicitado').order('criado_em', { ascending: false })
    setRess((r ?? []) as ResgateComEmbSG[])

    const { data: tr } = await supabase.from('resgates_sg')
      .select('*, embaixadores_sg(nome,email,cupom,pix_key)')
      .order('criado_em', { ascending: false })
    setTodosResgates((tr ?? []) as ResgateComEmbSG[])

    const ontem = new Date(Date.now() - 86400000).toISOString()
    const { data: novos } = await supabase.from('embaixadores_sg')
      .select('id,nome,whatsapp,cupom,criado_em').gte('criado_em', ontem)
    const t30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: inat } = await supabase.from('embaixadores_sg')
      .select('id,nome,whatsapp,cupom,ultimo_acesso')
      .lt('ultimo_acesso', t30).eq('status', 'ativo')

    setFila([
      ...(novos ?? []).map((x) => ({ ...x, motivo: 'Novo cadastro - boas-vindas' })),
      ...(inat ?? []).map((x) => ({ ...x, motivo: 'Inativo +30d - reengajar' })),
    ])

    const { data: b } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_ativo').maybeSingle()
    if (b?.valor) setBanner(b.valor as string)
    const { data: bc } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_caption').maybeSingle()
    setBannerCaption((bc?.valor as string) ?? '')
    const { data: ba } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_altura').maybeSingle()
    if (ba?.valor) setBannerAltura(Number(ba.valor))

    setLoading(false)
  }

  async function loadDashboard(dias: number | null, customDe: string | null, customAte: string | null) {
    let desdeISO: string, ateISO: string
    if (customDe && customAte) { desdeISO = customDe; ateISO = customAte }
    else { desdeISO = daysAgoBR(dias ?? 30); ateISO = daysAgoBR(0) }
    const desde = desdeISO + 'T00:00:00-03:00'
    const ate = ateISO + 'T23:59:59-03:00'
    const diasRange = Math.round((new Date(ateISO).getTime() - new Date(desdeISO).getTime()) / 86400000) + 1

    const { data: coms } = await supabase.from('comissoes_sg')
      .select('embaixador_sg_id,valor_pedido,valor_comissao,status,payment_status,criado_em')
      .gte('criado_em', desde).lte('criado_em', ate).order('criado_em', { ascending: true })
    const { data: todosEmbs } = await supabase.from('embaixadores_sg').select('id,nome,status,criado_em')
    const { data: resgAll } = await supabase.from('resgates_sg').select('valor,status,criado_em')
      .order('criado_em', { ascending: true })

    type DayEntry = { f: number; c: number }
    type CadEntry = { cadastros: number }
    const fatD: Record<string, DayEntry> = {}
    const cadD: Record<string, CadEntry> = {}
    for (let d = 0; d < diasRange; d++) {
      const dt = new Date(new Date(desdeISO).getTime() + d * 86400000)
      const key = dt.toISOString().slice(0, 10)
      fatD[key] = { f: 0, c: 0 }; cadD[key] = { cadastros: 0 }
    }
    ;(coms ?? []).forEach((c) => {
      const k = toBRDate(c.criado_em)
      if (fatD[k]) { fatD[k].f += c.valor_pedido ?? 0; fatD[k].c += c.valor_comissao ?? 0 }
    })
    ;(todosEmbs ?? []).filter((e) => e.criado_em >= desde && e.criado_em <= ate).forEach((e) => {
      const k = toBRDate(e.criado_em)
      if (cadD[k]) cadD[k].cadastros += 1
    })

    const timeline = Object.keys(fatD).sort().map((k) => ({
      data: keyToLabel(k),
      fat: Math.round(fatD[k].f * 100) / 100,
      comissao: Math.round(fatD[k].c * 100) / 100,
      cadastros: cadD[k]?.cadastros ?? 0,
    }))

    const pagos = (coms ?? []).filter((c) => c.payment_status === 'paid' || c.status === 'confirmada')
    const totalFat = pagos.reduce((s, c) => s + (c.valor_pedido ?? 0), 0)
    const totalCom = pagos.reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
    const totalPed = pagos.length
    const ticketMedio = totalPed > 0 ? totalFat / totalPed : 0
    const ativas = (todosEmbs ?? []).filter((e) => e.status === 'ativo').length
    const comVenda = new Set(pagos.map((c) => c.embaixador_sg_id).filter(Boolean)).size
    const cadPeriodo = (todosEmbs ?? []).filter(
      (e) => toBRDate(e.criado_em) >= desdeISO && toBRDate(e.criado_em) <= ateISO
    ).length

    const rankMap: Record<string, { id: string; fat: number; peds: number; com: number }> = {}
    pagos.forEach((c) => {
      if (!c.embaixador_sg_id) return
      if (!rankMap[c.embaixador_sg_id]) rankMap[c.embaixador_sg_id] = { id: c.embaixador_sg_id, fat: 0, peds: 0, com: 0 }
      rankMap[c.embaixador_sg_id].fat += c.valor_pedido ?? 0
      rankMap[c.embaixador_sg_id].peds += 1
      rankMap[c.embaixador_sg_id].com += c.valor_comissao ?? 0
    })
    const embMap: Record<string, string> = {}
    ;(todosEmbs ?? []).forEach((e) => { embMap[e.id] = e.nome })
    const top10 = Object.values(rankMap).sort((a, b) => b.fat - a.fat).slice(0, 10)
      .map((r) => ({ ...r, nome: (embMap[r.id] ?? '?').split(' ').slice(0, 2).join(' ') }))

    const resgMap: Record<string, { mes: string; valor: number; qtd: number }> = {}
    ;(resgAll ?? []).forEach((r) => {
      const k = toBRDate(r.criado_em).slice(0, 7)
      if (!resgMap[k]) resgMap[k] = { mes: keyToMonthLabel(k), valor: 0, qtd: 0 }
      resgMap[k].valor += r.valor ?? 0
      resgMap[k].qtd += 1
    })
    const resgPorMes = Object.values(resgMap).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6)

    setDash({ timeline, totalFat, totalCom, totalPed, ticketMedio, ativas, comVenda, cadPeriodo, top10, resgPorMes })
  }

  async function salvarBanner(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]; if (!file) return
    const { validarArquivo } = await import('@shared/utils/validators')
    const erroArquivo = validarArquivo(file, { maxSizeMB: 2, tiposPermitidos: ['image/jpeg', 'image/png', 'image/webp'] })
    if (erroArquivo) { setMsgBanner({ text: erroArquivo, ok: false }); return }
    setUploadando(true); setMsgBanner({ text: '', ok: false })
    setBannerPreview(URL.createObjectURL(file))
    const ext = file.name.split('.').pop()
    const path = `banners-sg/banner-sg-${Date.now()}.${ext}`
    const { uploadBanner } = await import('@shared/services/storageProxy')
    const result = await uploadBanner(file, 'banners', path)
    if ('error' in result) { setMsgBanner({ text: result.error, ok: false }); setUploadando(false); return }
    await supabase.from('config').upsert({ chave: 'banner_sg_ativo', valor: result.url }, { onConflict: 'chave' })
    setBanner(result.url); setBannerPreview(null)
    setMsgBanner({ text: 'Banner atualizado!', ok: true })
    setUploadando(false)
  }

  async function removerBanner() {
    await supabase.from('config').upsert({ chave: 'banner_sg_ativo', valor: null }, { onConflict: 'chave' })
    setBanner(''); setBannerPreview(null)
    setMsgBanner({ text: 'Banner removido.', ok: true })
  }

  async function salvarBannerCaption() {
    setSalvandoCaption(true)
    await supabase.from('config').upsert({ chave: 'banner_sg_caption', valor: bannerCaption || null }, { onConflict: 'chave' })
    setSalvandoCaption(false)
    setMsgBanner({ text: 'Mensagem salva!', ok: true })
  }

  async function salvarAltura() {
    setSalvandoAltura(true)
    await supabase.from('config').upsert({ chave: 'banner_sg_altura', valor: String(bannerAltura) }, { onConflict: 'chave' })
    setSalvandoAltura(false)
    setMsgBanner({ text: 'Altura salva!', ok: true })
  }

  async function salvarEdicao() {
    if (!editEmb) return
    setSavingEdit(true); setMsgEdit({ text: '', ok: false })
    const { error } = await supabase.from('embaixadores_sg').update({
      nome: editForm.nome, email: editForm.email, whatsapp: editForm.whatsapp,
      instagram: editForm.instagram, tiktok: editForm.tiktok, cupom: editForm.cupom,
      status: editForm.status, pix_key: editForm.pix_key,
    }).eq('id', editEmb.id)
    if (error) { setMsgEdit({ text: 'Erro: ' + error.message, ok: false }) }
    else { setMsgEdit({ text: 'Salvo!', ok: true }); setTimeout(() => { setEditEmb(null); load() }, 800) }
    setSavingEdit(false)
  }

  function parsarCSV(texto: string) {
    const linhas = texto.trim().split('\n').map((l) => l.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, '')))
    const header = linhas[0].map((h) => h.toLowerCase())
    const get = (row: string[], keys: string[]) => {
      for (const k of keys) { const i = header.indexOf(k); if (i >= 0 && row[i]) return row[i] }
      return ''
    }
    return linhas.slice(1).filter((r) => r.length > 1).map((row) => ({
      nome: get(row, ['nome', 'name']),
      email: get(row, ['email', 'e-mail']),
      whatsapp: get(row, ['whatsapp', 'telefone', 'phone']),
      cupom: get(row, ['cupom', 'coupon', 'codigo']),
      instagram: get(row, ['instagram']),
      status: 'ativo' as const,
    })).filter((r) => r.nome && r.email)
  }

  async function importarCSV() {
    setImportando(true); setMsgImport({ text: '', ok: false })
    let ok = 0, skip = 0
    for (const linha of csvLinhas) {
      const { data: existe } = await supabase.from('embaixadores_sg').select('id').eq('email', linha.email ?? '').maybeSingle()
      if (existe) { skip++; continue }
      await supabase.from('embaixadores_sg').insert({ ...linha, criado_em: new Date().toISOString() })
      ok++
    }
    setMsgImport({ text: `${ok} importadas, ${skip} ignoradas (já existiam).`, ok: true })
    setCsvLinhas([]); setImportando(false); await load()
  }

  function exportarCSV() {
    const BOM = '\uFEFF', sep = ';'
    const header = ['Nome', 'E-mail', 'WhatsApp', 'Instagram', 'Cupom', 'Status', 'Faturamento', 'Disponível']
    const rows = filtrados.map((e) => {
      const fat = (e.comissoes_sg ?? []).reduce((s, c) => s + (c.valor_comissao ?? 0), 0).toFixed(2).replace('.', ',')
      const disp = (e.comissoes_sg ?? [])
        .filter((c) => (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada)
        .reduce((s, c) => s + (c.valor_comissao ?? 0), 0).toFixed(2).replace('.', ',')
      return [e.nome, e.email, e.whatsapp ?? '', e.instagram ?? '', e.cupom, e.status ?? '', fat, disp].join(sep)
    })
    const csv = BOM + [header.join(sep), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'embaixadoras_sg.csv'; a.click()
  }

  function exportarFinanceiroCSV() {
    const BOM = '\uFEFF', sep = ';'
    const header = ['Nome', 'E-mail', 'Cupom', 'Pix', 'Valor', 'Status', 'Data']
    const rows = todosResgates.map((r) => [
      r.embaixadores_sg?.nome ?? '', r.embaixadores_sg?.email ?? '',
      r.embaixadores_sg?.cupom ?? '', r.pix_key ?? r.embaixadores_sg?.pix_key ?? '',
      String(r.valor ?? 0).replace('.', ','), r.status ?? '', fmt(r.criado_em),
    ].join(sep))
    const csv = BOM + [header.join(sep), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'resgates_sg.csv'; a.click()
  }

  if (loading) return (
    <div className={styles.page}><Header user={user} onLogout={onLogout} isAdmin /><Spinner /></div>
  )

  const statusColors: Record<string, string> = { solicitado: '#a0a0a0', aprovado: '#000', pago: '#2a9d5c', recusado: '#c00' }
  const statusLabels: Record<string, string> = { solicitado: 'Solicitado', aprovado: 'Aprovado', pago: 'Pago', recusado: 'Recusado' }

  return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} isAdmin />

      {/* Edit modal */}
      {editEmb && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setEditEmb(null) }}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Editar embaixadora</p>
            <div className={styles.modalFields}>
              {(['nome', 'email', 'whatsapp', 'instagram', 'tiktok', 'cupom', 'pix_key'] as const).map((k) => (
                <Input key={k} label={k === 'pix_key' ? 'Chave Pix' : k.charAt(0).toUpperCase() + k.slice(1)}
                  value={String(editForm[k] ?? '')}
                  onChange={(e) => setEditForm((p) => ({ ...p, [k]: e.target.value }))} />
              ))}
              <div className={styles.selectWrap}>
                <label className={styles.selectLabel}>Status</label>
                <select value={String(editForm.status ?? 'ativo')}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as EmbaixadorSG['status'] }))}
                  className={styles.select}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>
            {msgEdit.text && <Alert msg={msgEdit.text} ok={msgEdit.ok} />}
            <div className={styles.modalActions}>
              <BtnPrimary onClick={salvarEdicao} loading={savingEdit} style={{ width: 'auto', padding: '12px 28px' }}>Salvar</BtnPrimary>
              <BtnSecondary onClick={() => setEditEmb(null)}>Cancelar</BtnSecondary>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={TABS} labels={TAB_LABELS} active={tab} onChange={setTab}>

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          <div>
            <div className={styles.periodHeader}>
              <div>
                <p className={styles.periodTag}>Visão geral</p>
                <h2 className={styles.periodTitle}>Embaixadoras SG</h2>
              </div>
              <div className={styles.presetBtns}>
                {[7, 30].map((d) => (
                  <button key={d}
                    className={`${styles.presetBtn} ${dashModo === 'preset' && dashPeriodo === d ? styles.presetBtnActive : ''}`}
                    onClick={() => { setDashModo('preset'); setDashPeriodo(d) }}>
                    {d}D
                  </button>
                ))}
                <button
                  className={`${styles.presetBtn} ${dashModo === 'custom' ? styles.presetBtnActive : ''}`}
                  onClick={() => setDashModo('custom')}>
                  Personalizado
                </button>
                {dashModo === 'custom' && (
                  <div className={styles.dateRange}>
                    <input type="date" className={styles.dateInput} value={dashCustomDe}
                      onChange={(e) => setDashCustomDe(e.target.value)} />
                    <span className={styles.dateSep}>até</span>
                    <input type="date" className={styles.dateInput} value={dashCustomAte}
                      onChange={(e) => setDashCustomAte(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {!dash ? <Spinner /> : (
              <>
                <div className={styles.kpiGrid}>
                  {([
                    ['Faturamento', brl(dash.totalFat), 'pedidos pagos no período'],
                    ['Comissões', brl(dash.totalCom), 'geradas no período'],
                    ['Pedidos', String(dash.totalPed), 'com cupom'],
                    ['Ticket médio', brl(dash.ticketMedio), 'por pedido'],
                    ['Ativas', String(dash.ativas), 'embaixadoras'],
                    ['Com venda', String(dash.comVenda), 'venderam no período'],
                    ['Novos cad.', String(dash.cadPeriodo), 'no período'],
                    ['Total cad.', String(embs.length), 'embaixadoras'],
                  ] as [string, string, string][]).map(([label, val, sub]) => (
                    <div key={label} className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>{label}</p>
                      <p className={styles.kpiVal}>{val}</p>
                      <p className={styles.kpiSub}>{sub}</p>
                    </div>
                  ))}
                </div>

                <div className={styles.chartSection}>
                  <p className={styles.chartTitle}>Faturamento diário</p>
                  <p className={styles.chartSub}>Pedidos pagos (preto) vs comissão gerada (cinza)</p>
                  <BarChartSVG data={dash.timeline} valueKey="fat" labelKey="data"
                    isCurrency secondKey="comissao" secondLabel="Comissão" />
                </div>

                <div className={styles.chartSection}>
                  <p className={styles.chartTitle}>Cadastros diários</p>
                  <BarChartSVG data={dash.timeline} valueKey="cadastros" labelKey="data" />
                </div>

                <div className={styles.chartSection}>
                  <p className={styles.chartTitle}>Resgates por mês</p>
                  <p className={styles.chartSub}>Últimos 6 meses</p>
                  <BarChartSVG data={dash.resgPorMes} valueKey="valor" labelKey="mes" isCurrency />
                </div>

                {dash.top10.length > 0 && (
                  <div className={styles.chartSection}>
                    <p className={styles.chartTitle}>Top 10 embaixadoras — período</p>
                    <table className={styles.rankTable}>
                      <thead>
                        <tr className={styles.rankThead}>
                          {['#', 'Nome', 'Pedidos', 'Faturamento', 'Comissão'].map((h) => (
                            <th key={h} className={styles.rankTh}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dash.top10.map((r, i) => (
                          <tr key={r.id} className={`${styles.rankTr} ${i % 2 === 1 ? styles.rankTrAlt : ''}`}>
                            <td className={`${styles.rankTd} ${styles.rankNum}`}>{i + 1}</td>
                            <td className={`${styles.rankTd} ${styles.rankNome}`}>{r.nome}</td>
                            <td className={styles.rankTd}>{r.peds}</td>
                            <td className={`${styles.rankTd} ${styles.rankVal}`}>{brl(r.fat)}</td>
                            <td className={`${styles.rankTd} ${styles.rankCom}`}>{brl(r.com)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Embaixadoras ── */}
        {tab === 'embaixadoras' && (
          <div>
            <div className={styles.tabHeader}>
              <h2 className={styles.tabTitle}>Embaixadoras SG</h2>
              <BtnSecondary onClick={exportarCSV}>Exportar CSV</BtnSecondary>
            </div>
            <div className={styles.toolBar}>
              <input className={styles.search} type="text"
                placeholder="Buscar nome, e-mail ou cupom..."
                value={busca} onChange={(e) => setBusca(e.target.value)} />
              <div className={styles.sortBtns}>
                {[['data', 'Data'], ['nome', 'Nome'], ['faturamento', 'Faturamento'], ['disponivel', 'Disponível']].map(([v, l]) => (
                  <button key={v}
                    className={`${styles.sortBtn} ${ordemEmb === v ? styles.sortBtnActive : ''}`}
                    onClick={() => setOrdemEmb(v)}>{l}</button>
                ))}
              </div>
            </div>
            <p className={styles.countLabel}>{busca ? filtrados.length + ' encontradas' : embs.length + ' embaixadoras'}</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    {['Nome / Cupom', 'Contato', 'Status', 'Faturamento', 'Disponível', ''].map((h) => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((e, i) => {
                    const fat = (e.comissoes_sg ?? []).reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
                    const disp = (e.comissoes_sg ?? [])
                      .filter((c) => (c.payment_status === 'paid' || c.status === 'confirmada') && !c.resgatada)
                      .reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
                    return (
                      <tr key={e.id} className={`${styles.tr} ${i % 2 === 1 ? styles.trAlt : ''}`}>
                        <td className={styles.td}>
                          <p className={styles.tdNome}>{e.nome}</p>
                          <p className={styles.tdCupom}>{e.cupom}</p>
                        </td>
                        <td className={styles.td}>
                          <p className={styles.tdEmail}>{e.email}</p>
                          {e.whatsapp && <p className={styles.tdSub}>{e.whatsapp}</p>}
                        </td>
                        <td className={styles.td}>
                          <Badge text={e.status ?? 'ativo'}
                            color={e.status === 'ativo' ? '#000' : e.status === 'inativo' ? '#a0a0a0' : '#c07000'} />
                        </td>
                        <td className={`${styles.td} ${styles.tdVal}`}>{brl(fat)}</td>
                        <td className={`${styles.td} ${disp > 0 ? styles.tdDisp : styles.tdVal}`}>{brl(disp)}</td>
                        <td className={styles.td}>
                          <button className={styles.editBtn}
                            onClick={() => {
                              setEditEmb(e)
                              setEditForm({ nome: e.nome, email: e.email, whatsapp: e.whatsapp ?? '', instagram: e.instagram ?? '', tiktok: e.tiktok ?? '', cupom: e.cupom, status: e.status ?? 'ativo', pix_key: e.pix_key ?? '' })
                              setMsgEdit({ text: '', ok: false })
                            }}>Editar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Resgates ── */}
        {tab === 'resgates' && (
          <div>
            <p className={styles.tabTag}>Aprovação</p>
            <h2 className={styles.tabTitle2}>Resgates pendentes</h2>
            {ress.length === 0 ? (
              <p className={styles.empty}>Nenhum resgate pendente.</p>
            ) : ress.map((r) => {
              async function aprovar() { await supabase.from('resgates_sg').update({ status: 'aprovado' }).eq('id', r.id); await load() }
              async function recusar() {
                await supabase.from('resgates_sg').update({ status: 'recusado' }).eq('id', r.id)
                const { data: cs } = await supabase.from('comissoes_sg').select('id').eq('embaixador_id', r.embaixador_id).eq('resgatada', true)
                if (cs?.length) await supabase.from('comissoes_sg').update({ resgatada: false }).in('id', cs.map((c) => c.id))
                await load()
              }
              return (
                <div key={r.id} className={styles.resgateCard}>
                  <div>
                    <p className={styles.resgateNome}>{r.embaixadores_sg?.nome}</p>
                    <p className={styles.resgateEmail}>{r.embaixadores_sg?.email}</p>
                    <p className={styles.resgateEmail}>Pix: {r.pix_key ?? r.embaixadores_sg?.pix_key ?? '-'}</p>
                    <p className={styles.resgateDate}>{fmt(r.criado_em)}</p>
                  </div>
                  <div className={styles.resgateCardRight}>
                    <p className={styles.resgateValor}>{brl(r.valor)}</p>
                    <div className={styles.resgateActions}>
                      <BtnPrimary onClick={aprovar} style={{ width: 'auto', padding: '10px 20px' }}>Aprovar</BtnPrimary>
                      <BtnSecondary onClick={recusar}>Recusar</BtnSecondary>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Financeiro ── */}
        {tab === 'financeiro' && (
          <div>
            <div className={styles.tabHeader}>
              <div>
                <p className={styles.tabTag}>Histórico</p>
                <h2 className={styles.tabTitle2}>Financeiro SG</h2>
              </div>
              <BtnSecondary onClick={exportarFinanceiroCSV}>Exportar CSV</BtnSecondary>
            </div>
            {todosResgates.length === 0 ? (
              <p className={styles.empty}>Nenhum resgate ainda.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.thead}>
                      {['Nome', 'E-mail', 'Cupom', 'Pix', 'Valor', 'Status', 'Data'].map((h) => (
                        <th key={h} className={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todosResgates.map((r, i) => {
                      async function marcarPago() { await supabase.from('resgates_sg').update({ status: 'pago' }).eq('id', r.id); await load() }
                      return (
                        <tr key={r.id} className={`${styles.tr} ${i % 2 === 1 ? styles.trAlt : ''}`}>
                          <td className={`${styles.td} ${styles.tdNome}`}>{r.embaixadores_sg?.nome}</td>
                          <td className={styles.tdSub}>{r.embaixadores_sg?.email}</td>
                          <td className={styles.tdCupom}>{r.embaixadores_sg?.cupom}</td>
                          <td className={styles.tdSub}>{r.pix_key ?? r.embaixadores_sg?.pix_key ?? '-'}</td>
                          <td className={`${styles.td} ${styles.tdVal}`}>{brl(r.valor)}</td>
                          <td className={styles.td}>
                            <div className={styles.statusCell}>
                              <Badge text={statusLabels[r.status] ?? r.status} color={statusColors[r.status] ?? '#a0a0a0'} />
                              {r.status === 'aprovado' && (
                                <button className={styles.pagoBtn} onClick={marcarPago}>Pago</button>
                              )}
                            </div>
                          </td>
                          <td className={styles.tdSub}>{fmt(r.criado_em)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Fila ── */}
        {tab === 'fila' && (
          <div>
            <p className={styles.tabTag}>Contato</p>
            <h2 className={styles.tabTitle2}>Fila de contato</h2>
            {fila.length === 0 ? (
              <p className={styles.empty}>Fila vazia.</p>
            ) : fila.map((f) => (
              <div key={f.id} className={styles.filaRow}>
                <div>
                  <p className={styles.filaNome}>{f.nome}</p>
                  <p className={styles.filaMotivo}>{f.motivo}</p>
                </div>
                <div className={styles.filaActions}>
                  <a href={`https://wa.me/55${f.whatsapp?.replace(/\D/g, '')}`}
                    target="_blank" rel="noreferrer" className={styles.waLink}>WhatsApp →</a>
                  <button className={styles.feitoBtnSm}
                    onClick={() => setFila((prev) => prev.filter((x) => x.id !== f.id))}>
                    Feito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ranking ── */}
        {tab === 'ranking' && (
          <div>
            <p className={styles.tabTag}>Top embaixadoras</p>
            <h2 className={styles.tabTitle2}>Ranking</h2>
            {!dash ? <Spinner /> : dash.top10.length === 0 ? (
              <p className={styles.empty}>Sem dados no período.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    {['#', 'Nome', 'Pedidos', 'Faturamento', 'Comissão'].map((h) => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dash.top10.map((r, i) => (
                    <tr key={r.id} className={`${styles.tr} ${i % 2 === 1 ? styles.trAlt : ''}`}>
                      <td className={`${styles.td} ${styles.rankNum}`}>{i + 1}</td>
                      <td className={`${styles.td} ${styles.tdNome}`}>{r.nome}</td>
                      <td className={styles.td}>{r.peds}</td>
                      <td className={`${styles.td} ${styles.tdVal}`}>{brl(r.fat)}</td>
                      <td className={`${styles.td} ${styles.rankCom}`}>{brl(r.com)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Banner ── */}
        {tab === 'banner' && (
          <div className={styles.bannerTab}>
            <p className={styles.tabTag}>Comunicação</p>
            <h2 className={styles.tabTitle2}>Banner Embaixadoras SG</h2>

            {(bannerPreview ?? banner) && (
              <img src={bannerPreview ?? banner} alt="Banner atual" className={styles.bannerPreview} />
            )}

            <div className={styles.bannerField}>
              <label className={styles.bannerFieldLabel}>Imagem do banner</label>
              <div className={styles.bannerFieldActions}>
                <label className={styles.uploadLabel}>
                  {uploadando ? 'Enviando...' : 'Escolher imagem'}
                  <input type="file" accept="image/*" onChange={salvarBanner}
                    style={{ display: 'none' }} disabled={uploadando} />
                </label>
                {banner && <BtnSecondary onClick={removerBanner}>Remover banner</BtnSecondary>}
              </div>
            </div>

            <div className={styles.bannerField}>
              <Input label="Mensagem / legenda" value={bannerCaption}
                onChange={(e) => setBannerCaption(e.target.value)} />
              <div className={styles.bannerSaveBtn}>
                <BtnSecondary onClick={salvarBannerCaption}>
                  {salvandoCaption ? 'Salvando...' : 'Salvar mensagem'}
                </BtnSecondary>
              </div>
            </div>

            <div className={styles.bannerField}>
              <label className={styles.bannerFieldLabel}>Altura do banner (px)</label>
              <input type="number" className={styles.heightInput} value={bannerAltura}
                onChange={(e) => setBannerAltura(Number(e.target.value))} min={100} max={600} />
              <div className={styles.bannerSaveBtn}>
                <BtnSecondary onClick={salvarAltura}>
                  {salvandoAltura ? 'Salvando...' : 'Salvar altura'}
                </BtnSecondary>
              </div>
            </div>

            {msgBanner.text && <Alert msg={msgBanner.text} ok={msgBanner.ok} />}
          </div>
        )}

        {/* ── WhatsApp / Chat / Importar / Pré-estreia ── */}
        {tab === 'whatsapp' && (
          <div>
            <p className={styles.tabTag}>Mensagens</p>
            <h2 className={styles.tabTitle2}>WhatsApp</h2>
            <p className={styles.empty}>Dispatcher WhatsApp disponível no arquivo legado. Em desenvolvimento na nova versão.</p>
          </div>
        )}

        {tab === 'chat' && (
          <div>
            <p className={styles.tabTag}>Conversas</p>
            <h2 className={styles.tabTitle2}>Chat WhatsApp</h2>
            <p className={styles.empty}>Chat disponível no arquivo legado. Em desenvolvimento na nova versão.</p>
          </div>
        )}

        {/* ── Importar ── */}
        {tab === 'importar' && (
          <div>
            <p className={styles.tabTag}>Dados</p>
            <h2 className={styles.tabTitle2}>Importar embaixadoras</h2>
            <p className={styles.importInfo}>
              Cole ou carregue um CSV com colunas: nome, email, whatsapp, cupom, instagram.
            </p>
            <textarea className={styles.csvTextarea}
              placeholder="Cole o CSV aqui..."
              rows={8}
              onChange={(e) => {
                setCsvErro('')
                try { setCsvLinhas(parsarCSV(e.target.value)) }
                catch { setCsvErro('Erro ao parsear CSV.') }
              }} />
            {csvErro && <p className={styles.csvErro}>{csvErro}</p>}
            {csvLinhas.length > 0 && (
              <p className={styles.csvPreview}>{csvLinhas.length} linha(s) detectada(s). Pré-visualização: {csvLinhas.slice(0, 3).map((l) => l.nome).join(', ')}...</p>
            )}
            {msgImport.text && <div className={styles.importMsg}><Alert msg={msgImport.text} ok={msgImport.ok} /></div>}
            {csvLinhas.length > 0 && (
              <BtnPrimary onClick={importarCSV} loading={importando} style={{ width: 'auto', padding: '12px 32px', marginTop: 16 }}>
                Importar {csvLinhas.length} linha(s)
              </BtnPrimary>
            )}
          </div>
        )}

        {tab === 'estreia' && (
          <div>
            <p className={styles.tabTag}>Lista</p>
            <h2 className={styles.tabTitle2}>Pré-estreia</h2>
            <p className={styles.empty}>Lista pré-estreia disponível no arquivo legado. Em desenvolvimento na nova versão.</p>
          </div>
        )}

      </Tabs>
    </div>
  )
}
