import { useState } from 'react'
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

type Modo = 'login' | 'recuperar'

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
      redirectTo: window.location.origin + window.location.pathname,
    })
    setLoadingRec(false)
    if (error) { setErr('Não foi possível enviar o e-mail. Verifique o endereço.'); return }
    setEnviado(true)
  }

  return (
    <div className={styles.page}>
      <Header />
      <SplitLayout
        left={
          <div className={`stagger ${styles.leftContent}`}>
            <p className={styles.tagline}>Painel do Embaixador</p>
            <h1 className={styles.heroTitle}>
              {modo === 'login' ? (
                <span>Bem-vindo<br /><em>de volta.</em></span>
              ) : (
                <span>Recuperar<br /><em>acesso.</em></span>
              )}
            </h1>
          </div>
        }
        right={
          <div className={`stagger ${styles.rightContent}`}>
            {modo === 'login' ? (
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
