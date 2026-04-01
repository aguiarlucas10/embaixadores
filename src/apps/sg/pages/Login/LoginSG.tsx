import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@shared/services/supabase'
import { Logo } from '@shared/components/atoms/Logo/Logo'
import { Input } from '@shared/components/atoms/Input/Input'
import { Alert } from '@shared/components/atoms/Alert/Alert'
import { BtnPrimary } from '@shared/components/atoms/Button/Button'
import styles from './LoginSG.module.css'

export function PageLoginSG() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [modo, setModo] = useState<'login' | 'recuperar'>('login')
  const [enviado, setEnviado] = useState(false)
  const [loadingRec, setLoadingRec] = useState(false)

  async function entrar() {
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErr('E-mail ou senha incorretos.'); setLoading(false); return }
    const { data: isAdmin } = await supabase.rpc('check_is_admin')
    navigate(isAdmin ? '/sg/admin' : '/sg/painel')
  }

  async function recuperar() {
    setLoadingRec(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/sg/login',
    })
    setEnviado(true); setLoadingRec(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo subtitle="Embaixadoras SG" />
      </header>
      <div className={styles.center}>
        <div className={styles.box}>
          {modo === 'login' ? (
            <>
              <h1 className={styles.title}>Entrar</h1>
              <p className={styles.sub}>Portal Embaixadoras SG</p>
              <div className={styles.fields}>
                <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') entrar() }} />
              </div>
              {err && <div className={styles.alertWrap}><Alert msg={err} /></div>}
              <BtnPrimary onClick={entrar} loading={loading}>Entrar</BtnPrimary>
              <button className={styles.link} onClick={() => setModo('recuperar')}>
                Esqueci minha senha
              </button>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Recuperar senha</h1>
              {enviado ? (
                <Alert msg="Enviamos um link para o seu e-mail. Verifique a caixa de entrada." ok />
              ) : (
                <>
                  <p className={styles.sub}>Digite seu e-mail para receber o link de recuperação.</p>
                  <div className={styles.fields}>
                    <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <BtnPrimary onClick={recuperar} loading={loadingRec}>Enviar link</BtnPrimary>
                </>
              )}
              <button className={styles.link} onClick={() => setModo('login')}>
                Voltar ao login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
