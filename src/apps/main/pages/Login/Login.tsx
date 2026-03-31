import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@shared/services/supabase'
import { Header } from '@shared/components/layout/Header/Header'
import { SplitLayout } from '@shared/components/layout/SplitLayout/SplitLayout'
import { Input } from '@shared/components/atoms/Input/Input'
import { BtnPrimary } from '@shared/components/atoms/Button/Button'
import { TextLink } from '@shared/components/atoms/Button/Button'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import styles from './Login.module.css'

type Modo = 'login' | 'recuperar' | 'nova-senha'

interface LoginPageProps {
  onLogin: (user: User) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [modo, setModo] = useState<Modo>('login')
  const [enviado, setEnviado] = useState(false)
  const [loadingRec, setLoadingRec] = useState(false)

  // Nova senha (recovery)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [senhaSalva, setSenhaSalva] = useState(false)

  // Detectar recovery token na URL
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setModo('nova-senha')
    }
    // Também ouvir evento PASSWORD_RECOVERY do Supabase
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setModo('nova-senha')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function submit() {
    setErr('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setLoading(false)
    if (error) { setErr('E-mail ou senha incorretos.'); return }
    onLogin(data.user)
  }

  async function enviarRecuperacao() {
    if (!email) { setErr('Digite seu e-mail para continuar.'); return }
    setErr('')
    setLoadingRec(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    })
    setLoadingRec(false)
    if (error) { setErr('Não foi possível enviar o e-mail. Verifique o endereço.'); return }
    setEnviado(true)
  }

  async function salvarNovaSenha() {
    setErr('')
    if (!novaSenha || novaSenha.length < 6) { setErr('A senha deve ter pelo menos 6 caracteres.'); return }
    if (novaSenha !== confirmSenha) { setErr('As senhas não conferem.'); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSalvandoSenha(false)
    if (error) { setErr('Erro ao alterar senha: ' + error.message); return }
    setSenhaSalva(true)
  }

  return (
    <div className={styles.page}>
      <Header />
      <SplitLayout
        left={
          <div className={`stagger ${styles.leftContent}`}>
            <p className={styles.tagline}>Painel do Embaixador</p>
            <h1 className={styles.heroTitle}>
              {modo === 'nova-senha' ? (
                <span>Nova<br /><em>senha.</em></span>
              ) : modo === 'login' ? (
                <span>Bem-vindo<br /><em>de volta.</em></span>
              ) : (
                <span>Recuperar<br /><em>acesso.</em></span>
              )}
            </h1>
          </div>
        }
        right={
          <div className={`stagger ${styles.rightContent}`}>
            {modo === 'nova-senha' ? (
              senhaSalva ? (
                <>
                  <p className={styles.sectionLabel}>Senha alterada</p>
                  <div className={styles.infoBox}>
                    <p>Sua senha foi alterada com sucesso!</p>
                  </div>
                  <BtnPrimary onClick={() => { setModo('login'); setSenhaSalva(false); window.location.hash = '' }}>
                    Ir para o login
                  </BtnPrimary>
                </>
              ) : (
                <>
                  <p className={styles.sectionLabel}>Definir nova senha</p>
                  <p className={styles.hint}>Crie uma nova senha para sua conta.</p>
                  <div className={styles.fields}>
                    <Input label="Nova senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    <Input label="Confirmar senha" type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarNovaSenha()} />
                  </div>
                  {err && <div className={styles.alertWrap}><Alert msg={err} /></div>}
                  <BtnPrimary onClick={salvarNovaSenha} loading={salvandoSenha}>Salvar nova senha</BtnPrimary>
                </>
              )
            ) : modo === 'login' ? (
              <>
                <p className={styles.sectionLabel}>Entrar</p>
                <div className={styles.fields}>
                  <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input
                    label="Senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                </div>
                {err && <div className={styles.alertWrap}><Alert msg={err} /></div>}
                <BtnPrimary onClick={submit} loading={loading}>Entrar</BtnPrimary>
                <p className={styles.footerNote}>
                  <TextLink onClick={() => { setErr(''); setModo('recuperar') }}>Esqueci minha senha</TextLink>
                </p>
                <p className={styles.footerNote}>
                  Ainda não é embaixador?{' '}
                  <TextLink onClick={() => navigate('/')}>Cadastre-se</TextLink>
                </p>
              </>
            ) : enviado ? (
              <>
                <p className={styles.sectionLabel}>Recuperação de senha</p>
                <div className={styles.infoBox}>
                  <p>
                    Enviamos um link de redefinição para <strong>{email}</strong>.
                    Verifique sua caixa de entrada (e a pasta de spam).
                  </p>
                </div>
                <p className={styles.footerNote}>
                  <TextLink onClick={() => { setModo('login'); setEnviado(false) }}>← Voltar ao login</TextLink>
                </p>
              </>
            ) : (
              <>
                <p className={styles.sectionLabel}>Recuperação de senha</p>
                <p className={styles.hint}>
                  Digite seu e-mail e enviaremos um link para você redefinir sua senha.
                </p>
                <div className={styles.fields}>
                  <Input
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarRecuperacao()}
                  />
                </div>
                {err && <div className={styles.alertWrap}><Alert msg={err} /></div>}
                <BtnPrimary onClick={enviarRecuperacao} loading={loadingRec}>
                  Enviar link de recuperação
                </BtnPrimary>
                <p className={styles.footerNote}>
                  <TextLink onClick={() => { setErr(''); setModo('login') }}>← Voltar ao login</TextLink>
                </p>
              </>
            )}
          </div>
        }
      />
    </div>
  )
}
