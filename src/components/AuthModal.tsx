import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'

type Tab = 'signin' | 'signup'
type SignUpState = 'idle' | 'confirm_pending'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'transparent' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#ff4d4f' }
  if (score <= 3) return { score, label: 'Fair', color: '#ffd166' }
  if (score <= 4) return { score, label: 'Good', color: '#6ef0b9' }
  return { score, label: 'Strong', color: '#00e887' }
}

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )

export function AuthModal() {
  const { signIn, signUp } = useAuth()

  const [tab, setTab] = useState<Tab>('signin')
  const [signUpState, setSignUpState] = useState<SignUpState>('idle')
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingPassword, setPendingPassword] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isBypassing, setIsBypassing] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  const primaryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (signUpState === 'idle') primaryInputRef.current?.focus()
  }, [tab, signUpState])

  const strength = getPasswordStrength(password)
  const passwordsMatch = confirmPassword === '' || password === confirmPassword

  const markTouched = (field: string) =>
    setTouchedFields(prev => ({ ...prev, [field]: true }))

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('')
    setShowPassword(false); setShowConfirm(false)
    setError(null); setTouchedFields({})
    setSignUpState('idle'); setPendingEmail(''); setPendingPassword('')
  }

  const switchTab = (t: Tab) => { setTab(t); resetForm() }

  // ── Sign In ──────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setIsLoading(true); setError(null)
    const err = await signIn(email, password)
    setIsLoading(false)
    if (err) setError(err)
  }

  // ── Sign Up ──────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouchedFields({ name: true, email: true, password: true, confirm: true })
    if (!name || !email || !password || !confirmPassword) { setError('Please fill in all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setIsLoading(true); setError(null)
    const result = await signUp(email, password, name)
    setIsLoading(false)
    if (result === null) {
      // Auto-logged in (email confirm OFF) — modal closes via AuthContext
    } else if (result === 'CONFIRM_EMAIL') {
      // Email confirmation required → show bypass screen
      setPendingEmail(email)
      setPendingPassword(password)
      setSignUpState('confirm_pending')
    } else {
      setError(result)
    }
  }

  // ── Bypass: direct sign-in with whatever creds are in the fields (always visible) ──
  const handleDirectBypass = async () => {
    if (!email || !password) { setError('Enter your email and password above, then click Skip.'); return }
    setIsBypassing(true); setError(null)
    const err = await signIn(email, password)
    setIsBypassing(false)
    if (err) setError('Could not sign in — confirm your email first, or check your credentials.')
  }

  // ── Legacy bypass after signup flow ──
  const handleBypassSignIn = async () => {
    setIsBypassing(true); setError(null)
    const err = await signIn(pendingEmail || email, pendingPassword || password)
    setIsBypassing(false)
    if (err) setError('Email not confirmed yet — check your inbox first, then retry.')
  }

  const emailValid = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const nameValid = name.length === 0 || name.length >= 2

  return (
    <div className="auth-backdrop">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card" role="dialog" aria-modal="true" aria-label="Authentication">

        {/* ══ CONFIRM EMAIL BYPASS SCREEN ══════════════════ */}
        {signUpState === 'confirm_pending' ? (
          <div className="auth-bypass-screen">
            <div className="auth-bypass-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="url(#bypass-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="bypass-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ff7a18" />
                    <stop offset="1" stopColor="#ff8ed7" />
                  </linearGradient>
                </defs>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>

            <h2 className="auth-headline" style={{ fontSize: '1.35rem', marginBottom: 8 }}>
              Account created!
            </h2>
            <p className="auth-bypass-body">
              A confirmation link was sent to <strong>{pendingEmail}</strong>.
            </p>
            <p className="auth-bypass-body" style={{ marginTop: 4 }}>
              If you've <strong>disabled email confirmation</strong> in your Supabase project, click below to enter the app immediately:
            </p>

            {error && (
              <div className="auth-alert auth-alert-error" role="alert" style={{ marginTop: 14 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            {/* Primary: bypass button */}
            <button
              className="auth-submit-btn"
              style={{ marginTop: 20 }}
              onClick={handleBypassSignIn}
              disabled={isBypassing}
              id="btn-bypass-enter"
            >
              {isBypassing ? <span className="auth-spinner" /> : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Enter App Now
                </>
              )}
            </button>

            {/* Divider */}
            <div className="auth-bypass-divider">
              <span>or</span>
            </div>

            {/* Secondary: confirm email then sign in */}
            <button
              className="auth-bypass-secondary"
              onClick={() => switchTab('signin')}
              id="btn-bypass-signin"
            >
              I've confirmed — take me to Sign In
            </button>

            <p className="auth-switch-hint" style={{ marginTop: 16 }}>
              <button type="button" className="auth-switch-link" onClick={resetForm}>← Back</button>
            </p>
          </div>

        ) : (
          <>
            {/* ══ HEADER ══════════════════════════════════════ */}
            <div className="auth-header">
              <div className="auth-logo-row">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="url(#auth-lg)" strokeWidth="2" strokeDasharray="4 2 8 2" strokeLinecap="round" />
                  <path d="M12 2C16 2 19 6 19 12C19 18 16 22 12 22C8 22 5 18 5 12C5 6 8 2 12 2Z" stroke="url(#auth-lg)" strokeWidth="1" opacity="0.6" />
                  <defs>
                    <linearGradient id="auth-lg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#ff7a18" /><stop offset="1" stopColor="#ff8ed7" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="auth-brand-name">Open News</span>
              </div>
              <h2 className="auth-headline">{tab === 'signin' ? 'Welcome back' : 'Create account'}</h2>
              <p className="auth-sub">
                {tab === 'signin'
                  ? 'Sign in to your AI news intelligence platform.'
                  : 'Join Open News — global news, powered by AI.'}
              </p>
            </div>

            {/* ══ TABS ════════════════════════════════════════ */}
            <div className="auth-tabs" role="tablist">
              <button className={`auth-tab${tab === 'signin' ? ' active' : ''}`} onClick={() => switchTab('signin')} role="tab" aria-selected={tab === 'signin'} id="tab-signin">Sign In</button>
              <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')} role="tab" aria-selected={tab === 'signup'} id="tab-signup">Create Account</button>
              <div className={`auth-tab-indicator${tab === 'signup' ? ' right' : ' left'}`} />
            </div>

            {/* ══ ERROR ═══════════════════════════════════════ */}
            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            {/* ══ SIGN IN FORM ═════════════════════════════════ */}
            {tab === 'signin' && (
              <form className="auth-form" onSubmit={handleSignIn} noValidate>
                <div className={`auth-field${touchedFields.email && !emailValid ? ' field-error' : ''}`}>
                  <label htmlFor="si-email">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Email address
                  </label>
                  <div className="auth-input-wrap">
                    <input ref={primaryInputRef} id="si-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => markTouched('email')} placeholder="you@example.com" autoComplete="email" required />
                  </div>
                  {touchedFields.email && !emailValid && <span className="field-hint error">Enter a valid email address.</span>}
                </div>

                <div className="auth-field">
                  <div className="auth-label-row">
                    <label htmlFor="si-password">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Password
                    </label>
                    <button type="button" className="auth-forgot" tabIndex={-1} onClick={() => setError('Go to Supabase Dashboard → Authentication → Reset Password to send a reset email.')}>
                      Forgot password?
                    </button>
                  </div>
                  <div className="auth-input-wrap">
                    <input id="si-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide' : 'Show'} tabIndex={-1}><EyeIcon open={showPassword} /></button>
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={isLoading} id="btn-signin">
                  {isLoading ? <span className="auth-spinner" /> : <>Sign In <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></>}
                </button>

                <p className="auth-switch-hint">No account? <button type="button" className="auth-switch-link" onClick={() => switchTab('signup')}>Create one free →</button></p>
              </form>
            )}

            {/* ══ SIGN UP FORM ═════════════════════════════════ */}
            {tab === 'signup' && (
              <form className="auth-form" onSubmit={handleSignUp} noValidate>
                <div className={`auth-field${touchedFields.name && !nameValid ? ' field-error' : ''}`}>
                  <label htmlFor="su-name">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Display name
                  </label>
                  <div className="auth-input-wrap">
                    <input ref={primaryInputRef} id="su-name" type="text" value={name} onChange={e => setName(e.target.value)} onBlur={() => markTouched('name')} placeholder="Ahmad Kazim" autoComplete="name" required />
                  </div>
                  {touchedFields.name && !nameValid && <span className="field-hint error">Name must be at least 2 characters.</span>}
                </div>

                <div className={`auth-field${touchedFields.email && !emailValid ? ' field-error' : ''}`}>
                  <label htmlFor="su-email">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Email address
                  </label>
                  <div className="auth-input-wrap">
                    <input id="su-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => markTouched('email')} placeholder="you@example.com" autoComplete="email" required />
                  </div>
                  {touchedFields.email && !emailValid && <span className="field-hint error">Enter a valid email address.</span>}
                </div>

                <div className="auth-field">
                  <label htmlFor="su-password">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Password
                  </label>
                  <div className="auth-input-wrap">
                    <input id="su-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onBlur={() => markTouched('password')} placeholder="Min. 6 characters" autoComplete="new-password" required />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide' : 'Show'} tabIndex={-1}><EyeIcon open={showPassword} /></button>
                  </div>
                  {password.length > 0 && (
                    <div className="auth-strength">
                      <div className="auth-strength-bars">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="auth-strength-bar" style={{ background: i <= strength.score ? strength.color : undefined }} />
                        ))}
                      </div>
                      <span className="auth-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                  )}
                </div>

                <div className={`auth-field${touchedFields.confirm && !passwordsMatch ? ' field-error' : ''}`}>
                  <label htmlFor="su-confirm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Confirm password
                  </label>
                  <div className="auth-input-wrap">
                    <input id="su-confirm" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onBlur={() => markTouched('confirm')} placeholder="••••••••" autoComplete="new-password" required />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide' : 'Show'} tabIndex={-1}><EyeIcon open={showConfirm} /></button>
                  </div>
                  {touchedFields.confirm && !passwordsMatch && <span className="field-hint error">Passwords don't match.</span>}
                  {touchedFields.confirm && passwordsMatch && confirmPassword.length > 0 && <span className="field-hint success">Passwords match ✓</span>}
                </div>

                <button type="submit" className="auth-submit-btn" disabled={isLoading} id="btn-signup">
                  {isLoading ? <span className="auth-spinner" /> : <>Create Account <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></>}
                </button>

                {/* ── ALWAYS-VISIBLE BYPASS SECTION ─────────── */}
                <div className="auth-bypass-panel">
                  <div className="auth-bypass-panel-label">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Email confirmation enabled? Skip it:
                  </div>
                  <button
                    type="button"
                    className="auth-bypass-btn"
                    onClick={handleDirectBypass}
                    disabled={isBypassing}
                    id="btn-skip-confirm"
                  >
                    {isBypassing
                      ? <span className="auth-spinner" style={{ width: 14, height: 14 }} />
                      : <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                          Already registered? Skip &amp; Enter App
                        </>
                    }
                  </button>
                </div>

                <p className="auth-switch-hint">Already have an account? <button type="button" className="auth-switch-link" onClick={() => switchTab('signin')}>Sign in →</button></p>
              </form>
            )}

            {/* Footer */}
            <div className="auth-footer">
              <div className="auth-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Secured by <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
