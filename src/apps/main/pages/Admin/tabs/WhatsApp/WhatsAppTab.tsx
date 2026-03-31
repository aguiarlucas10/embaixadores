import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@shared/services/supabase'
import { BtnPrimary, BtnSecondary, BtnGhost } from '@shared/components/atoms/Button/Button'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import styles from './WhatsAppTab.module.css'

const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] as string
const ANON_KEY = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

interface WhatsAppTabProps {
  embs: Array<{
    id: string
    nome: string
    whatsapp: string
    cupom: string
    status: string
    nivel: string
    instagram?: string
  }>
}

interface Template {
  name: string
  language: string
  body: string
  status: string
}

interface LogEntry {
  nome: string
  ok: boolean
  msg: string
}

interface Agendamento {
  id: string
  template_name: string
  destino: string
  data_hora: string
  criado_em: string
}

type Destino = 'todos' | 'destaque_influenciadores' | 'pre_estreia' | 'manual'

const DEST_LABELS: Record<Destino, string> = {
  todos: 'Todos ativos',
  destaque_influenciadores: 'Destaque e Influenciadores',
  pre_estreia: 'Pré-estreia',
  manual: 'Seleção manual',
}

const AUTO_KEYS = [
  { key: 'novo_cadastro', label: 'Novo cadastro', desc: 'Enviar template de boas-vindas ao novo cadastro' },
  { key: 'marco_atingido', label: 'Marco atingido', desc: 'Notificar ao atingir marco de vendas' },
  { key: 'resgate_solicitado', label: 'Resgate solicitado', desc: 'Confirmação de solicitação de resgate' },
  { key: 'inativo_30d', label: 'Inativo 30 dias', desc: 'Reengajar embaixadoras inativas há 30+ dias' },
]

export function WhatsAppTab({ embs }: WhatsAppTabProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTpl, setLoadingTpl] = useState(true)
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null)
  const [destino, setDestino] = useState<Destino>('todos')
  const [manualIds, setManualIds] = useState<Set<string>>(new Set())
  const [preEstreiaPhones, setPreEstreiaPhones] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null)

  // Scheduling
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [savingSched, setSavingSched] = useState(false)

  // Automations
  const [autos, setAutos] = useState<Record<string, boolean>>({
    novo_cadastro: false,
    marco_atingido: false,
    resgate_solicitado: false,
    inativo_30d: false,
  })
  const [savingAuto, setSavingAuto] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoadingTpl(true)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/bright-api?action=wa_templates`,
        { headers: { Authorization: `Bearer ${ANON_KEY}` } }
      )
      if (!res.ok) throw new Error('Falha ao carregar templates')
      const data = await res.json()
      const approved = (data.templates ?? data ?? []).filter(
        (t: Template) => t.status === 'APPROVED'
      )
      setTemplates(approved)
    } catch {
      setAlert({ text: 'Erro ao carregar templates', ok: false })
    } finally {
      setLoadingTpl(false)
    }
  }, [])

  const loadAgendamentos = useCallback(async () => {
    const { data } = await supabase
      .from('agendamentos_disparo')
      .select('*')
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true })
    setAgendamentos(data ?? [])
  }, [])

  const loadAutomations = useCallback(async () => {
    const { data } = await supabase
      .from('config')
      .select('valor')
      .eq('chave', 'automacoes_whatsapp')
      .maybeSingle()
    if (data?.valor) {
      try {
        const parsed = JSON.parse(data.valor)
        setAutos((prev) => ({ ...prev, ...parsed }))
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    loadTemplates()
    loadAgendamentos()
    loadAutomations()
  }, [loadTemplates, loadAgendamentos, loadAutomations])

  useEffect(() => {
    if (destino === 'pre_estreia') {
      supabase
        .from('pre_estreia')
        .select('whatsapp')
        .then(({ data }) => {
          setPreEstreiaPhones((data ?? []).map((d) => d.whatsapp).filter(Boolean))
        })
    }
  }, [destino])

  function getRecipients() {
    const ativos = embs.filter((e) => e.status === 'ativo' && e.whatsapp)
    switch (destino) {
      case 'todos':
        return ativos
      case 'destaque_influenciadores':
        return ativos.filter((e) => e.nivel === 'destaque' || e.nivel === 'influenciadora')
      case 'pre_estreia':
        return ativos.filter((e) => preEstreiaPhones.includes(e.whatsapp))
      case 'manual':
        return ativos.filter((e) => manualIds.has(e.id))
      default:
        return []
    }
  }

  async function disparar() {
    if (!selectedTpl || sending) return
    const recipients = getRecipients()
    if (recipients.length === 0) {
      setAlert({ text: 'Nenhum destinatário selecionado', ok: false })
      return
    }

    setSending(true)
    setLog([])
    setAlert(null)

    let ok = 0
    let fail = 0

    for (const emb of recipients) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/bright-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'wa_send_template',
            to: emb.whatsapp,
            template_name: selectedTpl.name,
            template_language: selectedTpl.language,
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: emb.nome },
                  { type: 'text', text: 'https://embaixadores.saintgermainbrand.com.br' },
                  { type: 'text', text: emb.cupom },
                ],
              },
            ],
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        ok++
        setLog((prev) => [...prev, { nome: emb.nome, ok: true, msg: 'Enviado' }])
      } catch (err) {
        fail++
        setLog((prev) => [
          ...prev,
          { nome: emb.nome, ok: false, msg: err instanceof Error ? err.message : 'Erro' },
        ])
      }
      // 200ms delay between sends
      await new Promise((r) => setTimeout(r, 200))
    }

    setSending(false)
    setAlert({
      text: `Disparo concluído: ${ok} enviados, ${fail} falhas`,
      ok: fail === 0,
    })
  }

  async function salvarAgendamento() {
    if (!selectedTpl || !schedDate || !schedTime) {
      setAlert({ text: 'Selecione template, data e hora', ok: false })
      return
    }
    setSavingSched(true)
    const dataHora = new Date(`${schedDate}T${schedTime}:00`).toISOString()
    const { error } = await supabase.from('agendamentos_disparo').insert({
      template_name: selectedTpl.name,
      destino,
      data_hora: dataHora,
    })
    if (error) {
      setAlert({ text: 'Erro ao salvar agendamento', ok: false })
    } else {
      setAlert({ text: 'Agendamento salvo', ok: true })
      setSchedDate('')
      setSchedTime('')
      await loadAgendamentos()
    }
    setSavingSched(false)
  }

  async function cancelarAgendamento(id: string) {
    await supabase.from('agendamentos_disparo').delete().eq('id', id)
    await loadAgendamentos()
  }

  async function toggleAuto(key: string) {
    const updated = { ...autos, [key]: !autos[key] }
    setAutos(updated)
    setSavingAuto(true)
    await supabase.from('config').upsert(
      { chave: 'automacoes_whatsapp', valor: JSON.stringify(updated) },
      { onConflict: 'chave' }
    )
    setSavingAuto(false)
  }

  function toggleManual(id: string) {
    setManualIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const recipients = getRecipients()

  if (loadingTpl) return <Spinner />

  return (
    <div className={styles.container}>
      {alert && <Alert msg={alert.text} ok={alert.ok} />}

      {/* ── Templates ── */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Template</p>
        {templates.length === 0 ? (
          <p style={{ color: '#888', fontSize: 13 }}>Nenhum template aprovado encontrado</p>
        ) : (
          <div className={styles.templateList}>
            {templates.map((tpl) => (
              <div
                key={tpl.name}
                className={`${styles.templateItem} ${selectedTpl?.name === tpl.name ? styles.templateItemActive : ''}`}
                onClick={() => setSelectedTpl(tpl)}
              >
                <div
                  className={`${styles.templateRadio} ${selectedTpl?.name === tpl.name ? styles.templateRadioActive : ''}`}
                />
                <div>
                  <div className={styles.templateName}>{tpl.name}</div>
                  <div className={styles.templateBody}>{tpl.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Destinatários ── */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Destinatários</p>
        <div className={styles.destRow}>
          {(Object.keys(DEST_LABELS) as Destino[]).map((d) => (
            <button
              key={d}
              className={`${styles.destBtn} ${destino === d ? styles.destBtnActive : ''}`}
              onClick={() => setDestino(d)}
            >
              {DEST_LABELS[d]}
            </button>
          ))}
        </div>

        {destino === 'manual' && (
          <div className={styles.manualGrid}>
            {embs
              .filter((e) => e.status === 'ativo' && e.whatsapp)
              .map((e) => (
                <label key={e.id} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={manualIds.has(e.id)}
                    onChange={() => toggleManual(e.id)}
                  />
                  {e.nome}
                </label>
              ))}
          </div>
        )}

        <p className={styles.recipientCount}>
          {recipients.length} destinatário{recipients.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Disparar ── */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Disparar agora</p>
        <div className={styles.actionsRow}>
          <BtnPrimary onClick={disparar} loading={sending} disabled={!selectedTpl}>
            Disparar agora
          </BtnPrimary>
        </div>

        {log.length > 0 && (
          <div className={styles.logContainer} style={{ marginTop: 12 }}>
            {log.map((entry, i) => (
              <div key={i} className={entry.ok ? styles.logOk : styles.logErr}>
                {entry.nome}: {entry.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Agendamento ── */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Agendar disparo</p>
        <div className={styles.scheduleRow}>
          <input
            type="date"
            className={styles.scheduleInput}
            value={schedDate}
            onChange={(e) => setSchedDate(e.target.value)}
          />
          <input
            type="time"
            className={styles.scheduleInput}
            value={schedTime}
            onChange={(e) => setSchedTime(e.target.value)}
          />
          <BtnSecondary onClick={salvarAgendamento} loading={savingSched}>
            Agendar
          </BtnSecondary>
        </div>

        {agendamentos.length > 0 && (
          <>
            <p className={styles.sectionTitle} style={{ marginTop: 16 }}>Agendamentos pendentes</p>
            <div className={styles.pendingList}>
              {agendamentos.map((ag) => (
                <div key={ag.id} className={styles.pendingItem}>
                  <span className={styles.pendingInfo}>
                    {ag.template_name} &middot; {ag.destino} &middot;{' '}
                    {new Date(ag.data_hora).toLocaleString('pt-BR')}
                  </span>
                  <BtnGhost onClick={() => cancelarAgendamento(ag.id)}>Cancelar</BtnGhost>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Automações ── */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Automações</p>
        <div className={styles.autoGrid}>
          {AUTO_KEYS.map(({ key, label, desc }) => (
            <div key={key} className={styles.autoItem}>
              <div>
                <div className={styles.autoLabel}>{label}</div>
                <div className={styles.autoDesc}>{desc}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={autos[key] ?? false}
                  onChange={() => toggleAuto(key)}
                  disabled={savingAuto}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
