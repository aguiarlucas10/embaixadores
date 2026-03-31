import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@shared/services/supabase'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import styles from './ChatTab.module.css'

interface ChatTabProps {
  embs: Array<{ id: string; nome: string; whatsapp: string }>
  onUnread: (n: number) => void
}

interface Mensagem {
  id: string
  telefone: string
  conteudo: string
  direcao: 'enviada' | 'recebida'
  lida: boolean
  nome_contato: string | null
  criado_em: string
}

interface Conversa {
  telefone: string
  nome: string
  lastMsg: string
  lastDate: string
  unread: number
}

export function ChatTab({ embs, onUnread }: ChatTabProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phoneToName = useCallback((phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    const emb = embs.find((e) => e.whatsapp?.replace(/\D/g, '') === cleaned)
    return emb?.nome ?? phone
  }, [embs])

  const fetchMensagens = useCallback(async () => {
    const { data, error } = await supabase
      .from('mensagens_whatsapp')
      .select('*')
      .order('criado_em', { ascending: true })
    if (error) {
      setErro('Erro ao carregar mensagens')
      return
    }
    setMensagens(data ?? [])
    const unreadCount = (data ?? []).filter((m) => !m.lida && m.direcao === 'recebida').length
    onUnread(unreadCount)
  }, [onUnread])

  useEffect(() => {
    fetchMensagens().then(() => setLoading(false))
    pollRef.current = setInterval(fetchMensagens, 15000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMensagens])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, selected])

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (!selected) return
    const unreadIds = mensagens
      .filter((m) => m.telefone === selected && !m.lida && m.direcao === 'recebida')
      .map((m) => m.id)
    if (unreadIds.length > 0) {
      supabase
        .from('mensagens_whatsapp')
        .update({ lida: true })
        .in('id', unreadIds)
        .then(() => fetchMensagens())
    }
  }, [selected, mensagens, fetchMensagens])

  const conversas: Conversa[] = (() => {
    const map = new Map<string, Conversa>()
    for (const m of mensagens) {
      const existing = map.get(m.telefone)
      if (!existing) {
        map.set(m.telefone, {
          telefone: m.telefone,
          nome: m.nome_contato ?? phoneToName(m.telefone),
          lastMsg: m.conteudo,
          lastDate: m.criado_em,
          unread: (!m.lida && m.direcao === 'recebida') ? 1 : 0,
        })
      } else {
        if (m.criado_em > existing.lastDate) {
          existing.lastMsg = m.conteudo
          existing.lastDate = m.criado_em
        }
        if (!m.lida && m.direcao === 'recebida') existing.unread++
        if (!existing.nome || existing.nome === existing.telefone) {
          existing.nome = m.nome_contato ?? phoneToName(m.telefone)
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  })()

  const filteredConversas = busca
    ? conversas.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.telefone.includes(busca)
      )
    : conversas

  const chatMsgs = selected
    ? mensagens.filter((m) => m.telefone === selected)
    : []

  const selectedConv = conversas.find((c) => c.telefone === selected)

  async function enviar() {
    if (!texto.trim() || !selected || sending) return
    setSending(true)
    setErro('')
    try {
      const res = await fetch(
        `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/bright-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env['VITE_SUPABASE_ANON_KEY']}`,
          },
          body: JSON.stringify({
            action: 'wa_send_text',
            to: selected,
            text: texto.trim(),
          }),
        }
      )
      if (!res.ok) throw new Error('Falha ao enviar')
      setTexto('')
      await fetchMensagens()
    } catch {
      setErro('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return formatTime(iso)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  if (loading) return <Spinner />

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarSearch}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar conversa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className={styles.convList}>
          {filteredConversas.length === 0 && (
            <div style={{ padding: 16, color: '#aaa', fontSize: 12, textAlign: 'center' }}>
              Nenhuma conversa encontrada
            </div>
          )}
          {filteredConversas.map((c) => (
            <div
              key={c.telefone}
              className={`${styles.convItem} ${selected === c.telefone ? styles.convItemActive : ''}`}
              onClick={() => setSelected(c.telefone)}
            >
              <div className={styles.convInfo}>
                <p className={styles.convName}>{c.nome}</p>
                <p className={styles.convPreview}>{c.lastMsg}</p>
              </div>
              <div className={styles.convMeta}>
                <span className={styles.convDate}>{formatDate(c.lastDate)}</span>
                {c.unread > 0 && (
                  <span className={styles.unreadBadge}>{c.unread}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className={styles.chatPanel}>
        {!selected ? (
          <div className={styles.chatEmpty}>Selecione uma conversa</div>
        ) : (
          <>
            <div className={styles.chatHeader}>
              {selectedConv?.nome ?? selected}
              <span className={styles.chatHeaderPhone}>{selected}</span>
            </div>

            <div className={styles.messages}>
              {chatMsgs.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.bubbleRow} ${
                    m.direcao === 'enviada' ? styles.bubbleRowSent : styles.bubbleRowReceived
                  }`}
                >
                  <div
                    className={`${styles.bubble} ${
                      m.direcao === 'enviada' ? styles.bubbleSent : styles.bubbleReceived
                    }`}
                  >
                    {m.conteudo}
                    <div className={styles.bubbleTime}>{formatTime(m.criado_em)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {erro && <Alert msg={erro} />}

            <div className={styles.inputBar}>
              <input
                className={styles.msgInput}
                type="text"
                placeholder="Digite uma mensagem..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                disabled={sending}
              />
              <button
                className={styles.sendBtn}
                onClick={enviar}
                disabled={sending || !texto.trim()}
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
