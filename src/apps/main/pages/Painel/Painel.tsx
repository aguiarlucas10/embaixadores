import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@shared/services/supabase'
import { NS } from '@shared/services/nuvemshopApi'
import { brl, fmt, diasPassados } from '@shared/utils/formatters'
import type { Embaixador, Comissao, Resgate } from '@shared/types/database'
import { Header } from '@shared/components/layout/Header/Header'
import { Tabs } from '@shared/components/layout/Tabs/Tabs'
import { StatGrid } from '@shared/components/layout/StatGrid/StatGrid'
import { Row } from '@shared/components/layout/Row/Row'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { Badge } from '@shared/components/atoms/Badge/Badge'
import { BtnPrimary, BtnGhost } from '@shared/components/atoms/Button/Button'
import { Input } from '@shared/components/atoms/Input/Input'
import { validarNome, validarWhatsApp, validarPixKey, sanitizeObject } from '@shared/utils/validators'
import styles from './Painel.module.css'

const COMISSAO_PCT = Number(import.meta.env['VITE_COMISSAO_PCT'] ?? 0.1)
const JANELA_DEVOLUCAO = Number(import.meta.env['VITE_JANELA_DEVOLUCAO'] ?? 7)

interface PainelPageProps {
  user: User
  onLogout: () => void
}

interface PerfilForm {
  nome: string
  whatsapp: string
  instagram: string
  tiktok: string
  pix_key: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  cidade: string
  estado: string
}

interface Msg {
  text: string
  ok: boolean
}

function statusLabel(c: Comissao): [string, string] {
  if (c.payment_status === 'voided' || c.payment_status === 'refunded') return ['#c00', 'Cancelado']
  if (c.payment_status === 'abandoned') return ['#a0a0a0', 'Abandonado']
  if (c.status === 'confirmada') return ['#000', 'Confirmada']
  if (c.status === 'resgatada') return ['#000', 'Paga']
  return ['#a0a0a0', 'Pendente']
}

const bResgate: Record<string, [string, string]> = {
  solicitado: ['#a0a0a0', 'Solicitado'],
  aprovado: ['#000', 'Aprovado'],
  pago: ['#000', 'Pago'],
  recusado: ['#c00', 'Recusado'],
}

export function PainelPage({ user, onLogout }: PainelPageProps) {
  const [emb, setEmb] = useState<Embaixador | null>(null)
  const [cs, setCs] = useState<Comissao[]>([])
  const [rs, setRs] = useState<Resgate[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerCaption, setBannerCaption] = useState('')
  const [bannerAltura, setBannerAltura] = useState(200)
  const [grupoLink, setGrupoLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('inicio')
  const [sync, setSync] = useState(false)
  const [fResgate, setFResgate] = useState({ tipo: 'pix', pix: '' })
  const [msgR, setMsgR] = useState<Msg>({ text: '', ok: false })
  const [resgatando, setResgatando] = useState(false)
  const [perfil, setPerfil] = useState<PerfilForm>({
    nome: '', whatsapp: '', instagram: '', tiktok: '',
    pix_key: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', estado: '',
  })
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [msgPerfil, setMsgPerfil] = useState<Msg>({ text: '', ok: false })
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState<Msg>({ text: '', ok: false })
  const [copiadoLink, setCopiadoLink] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: e } = await supabase.from('embaixadores').select('*').eq('email', user.email!).single()
    if (!e) { setLoading(false); return }
    setEmb(e)
    setPerfil({
      nome: e.nome ?? '', whatsapp: e.whatsapp ?? '', instagram: e.instagram ?? '', tiktok: e.tiktok ?? '',
      pix_key: e.pix_key ?? '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', estado: '',
    })
    const { data: c } = await supabase.from('comissoes').select('*').eq('embaixador_id', e.id).order('criado_em', { ascending: false })
    setCs((c as Comissao[]) ?? [])
    const { data: r } = await supabase.from('resgates').select('*').eq('embaixador_id', e.id).order('criado_em', { ascending: false })
    setRs((r as Resgate[]) ?? [])
    const { data: b } = await supabase.from('config').select('*').eq('chave', 'banner_ativo').maybeSingle()
    if (b?.valor) setBanner(b.valor)
    const { data: bc } = await supabase.from('config').select('valor').eq('chave', 'banner_caption').maybeSingle()
    if (bc?.valor) setBannerCaption(bc.valor)
    const { data: ba } = await supabase.from('config').select('valor').eq('chave', 'banner_altura').maybeSingle()
    if (ba?.valor) setBannerAltura(Number(ba.valor))
    const { data: gl } = await supabase.from('config').select('valor').eq('chave', 'grupo_vip_link').maybeSingle()
    if (gl?.valor) setGrupoLink(gl.valor)
    setLoading(false)
  }

  async function sincronizar() {
    if (!emb) return
    setSync(true)
    const pedidos = await NS.ordersByCoupon(emb.cupom)
    for (const p of pedidos ?? []) {
      const cupons = (p as unknown as { coupon?: { code: string }[] }).coupon ?? []
      const usouCupom = cupons.some((c) => String(c.code ?? '').toUpperCase() === String(emb.cupom).toUpperCase())
      if (!usouCupom) continue
      if (p.payment_status === 'voided' || p.payment_status === 'refunded') continue
      const { data: ex } = await supabase.from('comissoes').select('id').eq('pedido_id', String(p.id)).maybeSingle()
      if (ex) continue
      const val = parseFloat(p.total)
      const status = p.payment_status === 'paid' ? (diasPassados(p.created_at, JANELA_DEVOLUCAO) ? 'confirmada' : 'pendente') : 'pendente'
      await supabase.from('comissoes').insert({
        embaixador_id: emb.id, pedido_id: String(p.id),
        valor_pedido: val, valor_comissao: val * COMISSAO_PCT,
        status, payment_status: p.payment_status, criado_em: p.created_at,
      })
    }
    await load()
    setSync(false)
  }

  async function resgatar() {
    const saldo = cs.filter((c) => c.status === 'confirmada' && !c.resgatada).reduce((s, c) => s + c.valor_comissao, 0)
    if (saldo <= 0) { setMsgR({ text: 'Nenhum saldo disponível para resgate.', ok: false }); return }
    if (saldo < 100) { setMsgR({ text: 'O valor mínimo para solicitar resgate é R$ 100,00. Continue acumulando!', ok: false }); return }
    const hoje = new Date()
    if (hoje.getDate() > 10) {
      const proxMes = hoje.getMonth() === 11 ? '01' : String(hoje.getMonth() + 2).padStart(2, '0')
      setMsgR({ text: `O prazo de solicitação (até dia 10) encerrou. Seu saldo acumulará para o próximo ciclo (dia 10/${proxMes}).`, ok: false })
      return
    }
    if (!emb?.pix_key) { setMsgR({ text: 'Cadastre sua chave Pix na aba Perfil antes de solicitar o resgate.', ok: false }); return }
    setResgatando(true)
    const pixUsada = fResgate.tipo === 'pix' ? (fResgate.pix || emb.pix_key) : ''
    await supabase.from('resgates').insert({
      embaixador_id: emb.id, valor: saldo, tipo: 'pix',
      pix_key: pixUsada, status: 'pendente', criado_em: new Date().toISOString(),
    })
    await supabase.from('comissoes').update({ resgatada: true }).eq('embaixador_id', emb.id).eq('status', 'confirmada').is('resgatada', null)
    setMsgR({ text: `Resgate de ${brl(saldo)} solicitado com sucesso! Pagamento até dia 20 deste mês.`, ok: true })
    await load()
    setResgatando(false)
  }

  async function salvarPerfil() {
    if (!emb) return
    setMsgPerfil({ text: '', ok: false })

    const erroNome = perfil.nome ? validarNome(perfil.nome) : null
    if (erroNome) { setMsgPerfil({ text: erroNome, ok: false }); return }
    const erroWhats = perfil.whatsapp ? validarWhatsApp(perfil.whatsapp) : null
    if (erroWhats) { setMsgPerfil({ text: erroWhats, ok: false }); return }
    const erroPix = perfil.pix_key ? validarPixKey(perfil.pix_key) : null
    if (erroPix) { setMsgPerfil({ text: erroPix, ok: false }); return }

    setSalvandoPerfil(true)
    const safe = sanitizeObject(perfil as unknown as Record<string, unknown>) as unknown as typeof perfil
    const { error } = await supabase.from('embaixadores').update({
      nome: safe.nome, whatsapp: safe.whatsapp,
      instagram: safe.instagram, tiktok: safe.tiktok,
      pix_key: safe.pix_key,
    }).eq('id', emb.id)
    setMsgPerfil(error ? { text: 'Erro ao salvar.', ok: false } : { text: 'Dados salvos com sucesso!', ok: true })
    setSalvandoPerfil(false)
    if (!error) await load()
  }

  async function trocarSenha() {
    setMsgSenha({ text: '', ok: false })
    if (!novaSenha || novaSenha.length < 6) { setMsgSenha({ text: 'A senha deve ter pelo menos 6 caracteres.', ok: false }); return }
    if (novaSenha !== confirmSenha) { setMsgSenha({ text: 'As senhas não conferem.', ok: false }); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setMsgSenha(error ? { text: 'Erro ao trocar senha: ' + error.message, ok: false } : { text: 'Senha alterada com sucesso!', ok: true })
    if (!error) { setNovaSenha(''); setConfirmSenha('') }
    setSalvandoSenha(false)
  }

  function copiarLink() {
    navigator.clipboard.writeText(window.location.origin + '/')
    setCopiadoLink(true)
    setTimeout(() => setCopiadoLink(false), 2500)
  }

  if (loading) return <div className={styles.page}><Header user={user} onLogout={onLogout} /><Spinner /></div>
  if (!emb) return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} />
      <div className={styles.notFound}><Alert msg="Cadastro não encontrado para este e-mail." /></div>
    </div>
  )

  const saldoDisp = cs.filter((c) => c.status === 'confirmada' && !c.resgatada).reduce((s, c) => s + c.valor_comissao, 0)
  const saldoPend = cs.filter((c) => c.status === 'pendente' && c.payment_status === 'paid').reduce((s, c) => s + c.valor_comissao, 0)

  return (
    <div className={styles.page}>
      <Header user={user} onLogout={onLogout} isAdmin={false} />
      <div className={`painel-wrap fade-in ${styles.wrap}`}>

        {/* Banner */}
        {banner && (
          <div className={styles.banner}>
            <img src={banner} alt="Promoção ativa" style={{ maxHeight: bannerAltura, objectFit: 'cover', width: '100%', display: 'block' }} />
            {bannerCaption && <div className={styles.bannerCaption}>{bannerCaption}</div>}
          </div>
        )}

        {/* Saudação */}
        <div className={styles.greeting}>
          <p className={styles.greetingTag}>Olá, {emb.nome.split(' ')[0]}</p>
          <h2 className={styles.greetingTitle}>Embaixador Saint Germain</h2>
        </div>

        {/* Cupom */}
        <div className={`cupom-bar ${styles.cupomBar}`}>
          <div>
            <p className={styles.cupomLabel}>Seu cupom exclusivo</p>
            <p className={`cupom-code ${styles.cupomCode}`}>{emb.cupom}</p>
          </div>
          <button className={styles.cupomCopy} onClick={() => { navigator.clipboard.writeText(emb.cupom); alert('Cupom copiado!') }}>
            Copiar
          </button>
        </div>

        {/* Grupo VIP */}
        {grupoLink && (
          <div className={styles.grupoVip}>
            <a href={grupoLink} target="_blank" rel="noopener noreferrer" className={styles.grupoVipLink}>
              Entrar no Grupo VIP WhatsApp →
            </a>
          </div>
        )}

        {/* Stats */}
        <StatGrid
          items={[
            [brl(saldoDisp), 'Disponível para resgate'],
            [brl(saldoPend), 'Pendente'],
            [brl(cs.reduce((s, c) => s + c.valor_pedido, 0)), 'Total em vendas'],
            [brl(cs.filter((c) => c.payment_status === 'paid' || c.status === 'confirmada').reduce((s, c) => s + c.valor_comissao, 0)), 'Comissão acumulada'],
          ]}
          cols={4}
        />

        {/* Tabs */}
        <Tabs
          tabs={['inicio', 'vendas', 'resgatar', 'perfil']}
          labels={{ inicio: 'Início', vendas: `Vendas (${cs.length})`, resgatar: 'Resgatar', perfil: '⚙ Perfil' }}
          active={tab}
          onChange={setTab}
        >
          {/* TAB INÍCIO */}
          {tab === 'inicio' && (
            <div className="fade-in">
              <div className={styles.tabHeader}>
                <p className={styles.tabLabel}>Últimas vendas</p>
                <BtnGhost onClick={sincronizar}>
                  {sync ? <span className={styles.syncSpinner} /> : 'Sincronizar'}
                </BtnGhost>
              </div>
              {cs.length === 0
                ? <p className={styles.empty}>Nenhuma venda registrada. Compartilhe seu cupom para começar.</p>
                : cs.slice(0, 5).map((c) => (
                  <Row
                    key={c.id}
                    left={
                      <div>
                        <p className={styles.rowTitle}>Pedido #{c.pedido_id}</p>
                        <p className={styles.rowSub}>{fmt(c.criado_em)}</p>
                      </div>
                    }
                    right={
                      <div className={styles.rowRight}>
                        <p className={styles.rowValue}>{brl(c.valor_comissao)}</p>
                        <Badge text={statusLabel(c)[1]} color={statusLabel(c)[0]} />
                      </div>
                    }
                  />
                ))}
              {cs.length > 5 && (
                <BtnGhost onClick={() => setTab('vendas')} style={{ marginTop: 16 }}>
                  Ver todas ({cs.length}) →
                </BtnGhost>
              )}
            </div>
          )}

          {/* TAB VENDAS */}
          {tab === 'vendas' && (
            <div className="fade-in">
              <div className={styles.tabHeader}>
                <p className={styles.tabLabel}>Histórico completo</p>
                <BtnGhost onClick={sincronizar}>
                  {sync ? <span className={styles.syncSpinner} /> : 'Sincronizar'}
                </BtnGhost>
              </div>
              {cs.length === 0
                ? <p className={styles.empty}>Nenhuma venda registrada ainda.</p>
                : cs.map((c) => (
                  <Row
                    key={c.id}
                    left={
                      <div>
                        <p className={styles.rowTitle}>Pedido #{c.pedido_id}</p>
                        <p className={styles.rowSub}>{fmt(c.criado_em)} · Pedido: {brl(c.valor_pedido)}</p>
                      </div>
                    }
                    right={
                      <div className={styles.rowRight}>
                        <p className={styles.rowValue}>+{brl(c.valor_comissao)}</p>
                        <Badge text={statusLabel(c)[1]} color={statusLabel(c)[0]} />
                      </div>
                    }
                  />
                ))}
            </div>
          )}

          {/* TAB RESGATAR */}
          {tab === 'resgatar' && (
            <div className="fade-in">
              <div className={styles.saldoWrap}>
                <p className={styles.saldoLabel}>Saldo disponível para resgate</p>
                <p className={styles.saldoValue}>{brl(saldoDisp)}</p>
                {saldoPend > 0 && <p className={styles.saldoPend}>{brl(saldoPend)} pendente — aguardando prazo de devolução</p>}
              </div>

              <div className={styles.resgateInfo}>
                <p className={styles.resgateInfoTitle}>Como funciona o resgate</p>
                <p className={styles.resgateInfoText}>
                  — Solicitações aceitas até o <strong>dia 10</strong> de cada mês<br />
                  — Pagamento realizado até o <strong>dia 20</strong> do mesmo mês<br />
                  — Valor mínimo para resgate: <strong>R$ 100,00</strong><br />
                  — Quem não solicitar acumula o saldo para o mês seguinte
                </p>
              </div>

              {!emb.pix_key && (
                <div className={styles.alertWrap}>
                  <Alert msg="Cadastre sua chave Pix na aba Perfil para habilitar o resgate." />
                  <button className={styles.irParaPerfil} onClick={() => setTab('perfil')}>Ir para Perfil →</button>
                </div>
              )}

              {emb.pix_key && saldoDisp > 0 && saldoDisp < 100 && (
                <div className={styles.alertWrap}>
                  <Alert msg={`Saldo atual de ${brl(saldoDisp)} ainda não atingiu o mínimo de R$ 100,00. Continue acumulando!`} />
                </div>
              )}

              {emb.pix_key && saldoDisp >= 100 && new Date().getDate() > 10 && (
                <div className={styles.alertWrap}>
                  <Alert msg={`O prazo de solicitação (até dia 10) encerrou para este mês. Seu saldo de ${brl(saldoDisp)} será acumulado para o próximo ciclo.`} />
                </div>
              )}

              {emb.pix_key && saldoDisp >= 100 && new Date().getDate() <= 10 && (
                <div className={styles.resgateForm}>
                  <p className={styles.resgateFormLabel}>Forma de resgate</p>
                  <div className={styles.tipoBtns}>
                    {([['credito', 'Crédito na loja'], ['pix', 'Pix']] as [string, string][]).map(([val, lbl], i) => (
                      <button
                        key={val}
                        className={`${styles.tipoBtn} ${fResgate.tipo === val ? styles.tipoBtnActive : ''}`}
                        style={{ borderRight: i === 0 ? '1px solid #000' : 'none' }}
                        onClick={() => setFResgate((p) => ({ ...p, tipo: val }))}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {fResgate.tipo === 'pix' && (
                    <div className={styles.pixInfo}>
                      <p>Chave Pix cadastrada: <strong>{emb.pix_key}</strong></p>
                      <button className={styles.alterarPix} onClick={() => setTab('perfil')}>Alterar no Perfil</button>
                    </div>
                  )}
                  <div className={styles.valorResgate}>
                    <p>Valor a resgatar: <strong className={styles.valorDestaque}>{brl(saldoDisp)}</strong></p>
                  </div>
                  {msgR.text && <div className={styles.alertWrap}><Alert msg={msgR.text} ok={msgR.ok} /></div>}
                  <BtnPrimary onClick={resgatar} loading={resgatando}>
                    Solicitar resgate de {brl(saldoDisp)}
                  </BtnPrimary>
                  <p className={styles.resgateNote}>Pagamento até o dia 20 deste mês.</p>
                </div>
              )}

              {rs.length > 0 && (
                <div className={styles.historicoResgates}>
                  <p className={styles.tabLabel}>Histórico de resgates</p>
                  {rs.map((r) => (
                    <Row
                      key={r.id}
                      left={
                        <div>
                          <p className={styles.rowTitle}>{r.tipo === 'pix' ? `Pix — ${r.pix_key}` : 'Crédito na loja'}</p>
                          <p className={styles.rowSub}>{fmt(r.criado_em)}</p>
                        </div>
                      }
                      right={
                        <div className={styles.rowRight}>
                          <p className={styles.rowValue}>{brl(r.valor)}</p>
                          <Badge text={bResgate[r.status]?.[1] ?? r.status} color={bResgate[r.status]?.[0] ?? '#000'} />
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB PERFIL */}
          {tab === 'perfil' && (
            <div className={`perfil-wrap fade-in ${styles.perfilWrap}`}>
              <div className={styles.perfilSection}>
                <p className={styles.tabLabel}>Dados pessoais</p>
                <div className={styles.perfilFields}>
                  <Input label="Nome" value={perfil.nome} onChange={(e) => setPerfil((p) => ({ ...p, nome: e.target.value }))} />
                  <Input label="WhatsApp" value={perfil.whatsapp} onChange={(e) => setPerfil((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
                  <Input label="Instagram" value={perfil.instagram} onChange={(e) => setPerfil((p) => ({ ...p, instagram: e.target.value }))} placeholder="@seuusuario" />
                  <Input label="TikTok" value={perfil.tiktok} onChange={(e) => setPerfil((p) => ({ ...p, tiktok: e.target.value }))} placeholder="@seuusuario" />
                </div>
              </div>

              <div className={styles.perfilSection}>
                <p className={styles.tabLabel}>Dados para resgate</p>
                <div className={styles.perfilFields}>
                  <Input label="Chave Pix" value={perfil.pix_key} onChange={(e) => setPerfil((p) => ({ ...p, pix_key: e.target.value }))} placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </div>
                {msgPerfil.text && <div className={styles.alertWrap}><Alert msg={msgPerfil.text} ok={msgPerfil.ok} /></div>}
                <BtnPrimary onClick={salvarPerfil} loading={salvandoPerfil}>Salvar dados</BtnPrimary>
              </div>

              <div className={`${styles.perfilSection} ${styles.perfilSectionBorder}`}>
                <p className={styles.tabLabel}>Trocar senha</p>
                <div className={styles.perfilFields}>
                  <Input label="Nova senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  <Input label="Confirmar nova senha" type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} />
                </div>
                {msgSenha.text && <div className={styles.alertWrap}><Alert msg={msgSenha.text} ok={msgSenha.ok} /></div>}
                <BtnPrimary onClick={trocarSenha} loading={salvandoSenha}>Alterar senha</BtnPrimary>
              </div>

              <div className={`${styles.perfilSection} ${styles.perfilSectionBorder}`}>
                <p className={styles.tabLabel}>Indicar o programa</p>
                <p className={styles.empty}>Compartilhe o link de cadastro com quem merece fazer parte.</p>
                <div className={styles.indicarLink}>
                  <span>{window.location.origin + '/'}</span>
                </div>
                <BtnPrimary onClick={copiarLink}>
                  {copiadoLink ? '✓ Link copiado!' : 'Copiar link de cadastro'}
                </BtnPrimary>
              </div>
            </div>
          )}
        </Tabs>
      </div>
    </div>
  )
}
