import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@shared/services/supabase'
import { NS } from '@shared/services/nuvemshopApi'
import { brl, fmt } from '@shared/utils/formatters'
import type { EmbaixadorSG, ComissaoSG, ResgateSG } from '@shared/types/database'
import { Header } from '@shared/components/layout/Header/Header'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { Badge } from '@shared/components/atoms/Badge/Badge'
import { BtnPrimary, BtnSecondary } from '@shared/components/atoms/Button/Button'
import { Input } from '@shared/components/atoms/Input/Input'
import { StatGrid } from '@shared/components/layout/StatGrid/StatGrid'
import styles from './PainelSG.module.css'

const COMISSAO_PCT = Number(import.meta.env['VITE_COMISSAO_PCT'] ?? 0.1)

interface PainelSGProps {
  user: User
  onLogout: () => void
}

export function PagePainelSG({ user, onLogout }: PainelSGProps) {
  const [emb, setEmb] = useState<EmbaixadorSG | null>(null)
  const [coms, setComs] = useState<ComissaoSG[]>([])
  const [resgates, setResgates] = useState<ResgateSG[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerCaption, setBannerCaption] = useState('')
  const [bannerAltura, setBannerAltura] = useState(200)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState(false)
  const [solicitando, setSolicitando] = useState(false)
  const [msgRes, setMsgRes] = useState({ text: '', ok: false })
  const [editando, setEditando] = useState(false)
  const [fEdit, setFEdit] = useState({ whatsapp: '', instagram: '', pix_key: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: e } = await supabase.from('embaixadores_sg').select('*').eq('email', user.email).maybeSingle()
    if (e) {
      setEmb(e as EmbaixadorSG)
      const { data: c } = await supabase.from('comissoes_sg').select('*')
        .eq('embaixador_sg_id', e.id).order('criado_em', { ascending: false })
      setComs((c ?? []) as ComissaoSG[])
      const { data: r } = await supabase.from('resgates_sg').select('*')
        .eq('embaixador_sg_id', e.id).order('criado_em', { ascending: false })
      setResgates((r ?? []) as ResgateSG[])
    }
    const { data: b } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_ativo').maybeSingle()
    if (b?.valor) setBanner(b.valor as string)
    const { data: bc } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_caption').maybeSingle()
    if (bc?.valor) setBannerCaption(bc.valor as string)
    const { data: ba } = await supabase.from('config').select('valor').eq('chave', 'banner_sg_altura').maybeSingle()
    if (ba?.valor) setBannerAltura(Number(ba.valor))
    setLoading(false)
  }

  async function sincronizar() {
    if (!emb) return
    setSync(true)
    const pedidos = await NS.ordersByCoupon(emb.cupom)
    for (const p of (pedidos ?? [])) {
      if (!p.coupon) continue
      const match = (p.coupon ?? []).find(
        (c) => (c.code ?? '').toUpperCase() === emb.cupom.toUpperCase()
      )
      if (!match) continue
      const { data: existe } = await supabase.from('comissoes_sg').select('id')
        .eq('pedido_id', String(p.id)).eq('embaixador_sg_id', emb.id).maybeSingle()
      if (existe) continue
      const val = parseFloat(String(p.total)) || 0
      const status = p.payment_status === 'paid' || p.payment_status === 'authorized' ? 'confirmada' : 'pendente'
      await supabase.from('comissoes_sg').insert({
        embaixador_sg_id: emb.id, pedido_id: String(p.id),
        valor_pedido: val, valor_comissao: val * COMISSAO_PCT,
        status, payment_status: p.payment_status, resgatada: false,
        criado_em: p.created_at,
      })
    }
    await load()
    setSync(false)
  }

  async function salvarPerfil() {
    if (!emb) return
    setSavingEdit(true)
    await supabase.from('embaixadores_sg').update({
      whatsapp: fEdit.whatsapp, instagram: fEdit.instagram, pix_key: fEdit.pix_key,
    }).eq('id', emb.id)
    setSavingEdit(false); setEditando(false); await load()
  }

  async function solicitar() {
    if (!emb || !podeSolicitar) return
    setSolicitando(true); setMsgRes({ text: '', ok: false })
    await supabase.from('resgates_sg').insert({
      embaixador_sg_id: emb.id, valor: saldoPago, tipo: 'pix',
      pix_key: emb.pix_key, status: 'solicitado',
      criado_em: new Date().toISOString(),
    })
    const ids = coms.filter((c) => c.status === 'confirmada' && !c.resgatada).map((c) => c.id)
    if (ids.length) await supabase.from('comissoes_sg').update({ resgatada: true }).in('id', ids)
    setMsgRes({ text: 'Resgate solicitado com sucesso! Pagamento até o dia 20.', ok: true })
    setSolicitando(false); await load()
  }

  if (loading) return (
    <div className={styles.page}><Header user={user} onLogout={onLogout} /><Spinner /></div>
  )

  if (!emb) return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} />
      <div className={styles.wrap}>
        <Alert msg="Conta não encontrada no programa Embaixadoras SG. Entre em contato com a equipe Saint Germain." />
      </div>
    </div>
  )

  const saldoPago = coms.filter((c) => c.status === 'confirmada' && !c.resgatada)
    .reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
  const totalGanho = coms.filter((c) => c.status === 'confirmada')
    .reduce((s, c) => s + (c.valor_comissao ?? 0), 0)
  const hoje = new Date().getDate()
  const podeSolicitar = saldoPago >= 100 && hoje <= 10 && !!emb.pix_key

  const statusColors: Record<string, string> = {
    solicitado: '#a0a0a0', aprovado: '#000', pago: '#2a9d5c', recusado: '#c00',
  }
  const statusLabels: Record<string, string> = {
    solicitado: 'Solicitado', aprovado: 'Aprovado', pago: 'Pago', recusado: 'Recusado',
  }

  return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} />

      {banner && (
        <div className={styles.bannerWrap}>
          <img src={banner} alt="Promoção" className={styles.bannerImg}
            style={{ maxHeight: bannerAltura }} />
          {bannerCaption && (
            <div className={styles.bannerCaption}>{bannerCaption}</div>
          )}
        </div>
      )}

      <div className={styles.wrap}>
        {/* Greeting */}
        <div className={styles.greeting}>
          <p className={styles.greetingTag}>Olá, {emb.nome.split(' ')[0]}</p>
          <h2 className={styles.greetingTitle}>Embaixadora Saint Germain</h2>
          <p className={styles.greetingCupom}>
            Cupom: <strong className={styles.cupomCode}>{emb.cupom}</strong>
          </p>
        </div>

        <StatGrid items={[
          [brl(saldoPago), 'Disponível para resgate'],
          [brl(totalGanho), 'Total ganho'],
          [String(coms.filter((c) => c.status === 'confirmada').length), 'Pedidos confirmados'],
          [String(coms.length), 'Total de pedidos'],
        ]} />

        {/* Resgate */}
        <div className={styles.resgateBox}>
          <p className={styles.boxTitle}>Solicitar resgate</p>
          {!emb.pix_key && <Alert msg="Cadastre sua chave Pix no perfil para solicitar resgate." />}
          {emb.pix_key && saldoPago < 100 && (
            <p className={styles.resgateInfo}>
              Saldo mínimo para resgate: <strong>R$ 100,00</strong>. Seu saldo atual é {brl(saldoPago)}. Continue vendendo!
            </p>
          )}
          {emb.pix_key && saldoPago >= 100 && hoje > 10 && (
            <p className={styles.resgateInfo}>
              Período de solicitação encerrado. Próxima janela: até o dia 10 do mês que vem.
            </p>
          )}
          {podeSolicitar && (
            <div>
              <p className={styles.resgateValorText}>
                Valor disponível: <strong className={styles.resgateValor}>{brl(saldoPago)}</strong>
              </p>
              <p className={styles.resgatePixInfo}>Pix: {emb.pix_key} — Pagamento até o dia 20.</p>
              <BtnPrimary onClick={solicitar} loading={solicitando} style={{ width: 'auto', padding: '12px 32px' }}>
                Solicitar resgate
              </BtnPrimary>
            </div>
          )}
          {msgRes.text && <div className={styles.msgWrap}><Alert msg={msgRes.text} ok={msgRes.ok} /></div>}
        </div>

        {/* Histórico comissões */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionTitle}>Histórico de vendas</p>
            <button className={styles.syncBtn} onClick={sincronizar} disabled={sync}>
              {sync ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
          {coms.length === 0 ? (
            <p className={styles.empty}>Nenhuma venda registrada ainda.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    {['Data', 'Pedido', 'Valor', 'Comissão', 'Status'].map((h) => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coms.map((c, i) => (
                    <tr key={c.id} className={`${styles.tr} ${i % 2 === 1 ? styles.trAlt : ''}`}>
                      <td className={styles.td}>{fmt(c.criado_em)}</td>
                      <td className={styles.td}>#{c.pedido_id}</td>
                      <td className={styles.td}>{brl(c.valor_pedido)}</td>
                      <td className={`${styles.td} ${styles.tdComissao}`}>{brl(c.valor_comissao)}</td>
                      <td className={styles.td}>
                        <Badge text={c.status} color={c.status === 'confirmada' ? '#2a9d5c' : '#a0a0a0'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resgates solicitados */}
        {resgates.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Resgates solicitados</p>
            {resgates.map((r) => (
              <div key={r.id} className={styles.resgateRow}>
                <div>
                  <p className={styles.rowSub}>{fmt(r.criado_em)}</p>
                  <p className={styles.rowSub}>Pix: {r.pix_key}</p>
                </div>
                <div className={styles.resgateRowRight}>
                  <p className={styles.resgateRowVal}>{brl(r.valor)}</p>
                  <Badge text={statusLabels[r.status] ?? r.status} color={statusColors[r.status] ?? '#a0a0a0'} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Perfil */}
        <div className={styles.perfilSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionTitle}>Meu perfil</p>
            {!editando && (
              <button className={styles.editBtn} onClick={() => {
                setFEdit({ whatsapp: emb.whatsapp ?? '', instagram: emb.instagram ?? '', pix_key: emb.pix_key ?? '' })
                setEditando(true)
              }}>Editar</button>
            )}
          </div>
          {editando ? (
            <div className={styles.editForm}>
              <Input label="WhatsApp" value={fEdit.whatsapp} onChange={(e) => setFEdit((p) => ({ ...p, whatsapp: e.target.value }))} />
              <Input label="Instagram" value={fEdit.instagram} onChange={(e) => setFEdit((p) => ({ ...p, instagram: e.target.value }))} />
              <Input label="Chave Pix" value={fEdit.pix_key} onChange={(e) => setFEdit((p) => ({ ...p, pix_key: e.target.value }))} />
              <div className={styles.editActions}>
                <BtnPrimary onClick={salvarPerfil} loading={savingEdit} style={{ width: 'auto', padding: '12px 28px' }}>Salvar</BtnPrimary>
                <BtnSecondary onClick={() => setEditando(false)}>Cancelar</BtnSecondary>
              </div>
            </div>
          ) : (
            <div className={styles.perfilRows}>
              {([
                ['Nome', emb.nome],
                ['E-mail', emb.email],
                ['WhatsApp', emb.whatsapp ?? '-'],
                ['Instagram', emb.instagram ?? '-'],
                ['Cupom', emb.cupom],
                ['Chave Pix', emb.pix_key ?? '⚠ Não cadastrada'],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className={styles.perfilRow}>
                  <span className={styles.perfilLabel}>{label}</span>
                  <span className={styles.perfilVal}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
