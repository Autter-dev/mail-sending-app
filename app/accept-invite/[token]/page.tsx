'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type ValidateResponse =
  | { valid: true; email: string; role: 'admin' | 'member'; expiresAt: string }
  | { valid: false; reason: 'invalid' | 'revoked' | 'used' | 'expired' }

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token ?? ''

  const [state, setState] = useState<ValidateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'hedwig'

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/public/accept-invite/${token}`)
      .then((r) => r.json())
      .then((data: ValidateResponse) => {
        if (!cancelled) setState(data)
      })
      .catch(() => {
        if (!cancelled) setState({ valid: false, reason: 'invalid' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (!state || !state.valid) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/accept-invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to accept invite')
        setSubmitting(false)
        return
      }

      const result = await signIn('credentials', {
        email: state.email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Account created but sign in failed. Please go to the login page.')
        setSubmitting(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout appName={appName}>
        <p className="text-muted-foreground">Loading...</p>
      </Layout>
    )
  }

  if (!state || !state.valid) {
    const message =
      state?.reason === 'expired'
        ? 'This invite has expired. Ask an admin for a new one.'
        : state?.reason === 'used'
          ? 'This invite has already been used.'
          : state?.reason === 'revoked'
            ? 'This invite has been revoked.'
            : 'This invite link is invalid.'
    return (
      <Layout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">
          Invite Unavailable
        </h1>
        <p className="text-muted-foreground">{message}</p>
      </Layout>
    )
  }

  return (
    <Layout appName={appName}>
      <h1 className="text-xl font-semibold font-heading text-foreground mb-2">
        Join the team
      </h1>
      <p className="text-muted-foreground mb-6">
        You were invited as <span className="font-medium">{state.email}</span>. Set a
        password to finish creating your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Joining...' : 'Join team'}
        </button>
      </form>
    </Layout>
  )
}

function Layout({ appName, children }: { appName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8 text-center">
          <Image
            src="/assets/logo/primary-logo.png"
            alt={appName}
            width={200}
            height={87}
            priority
            className="mx-auto mb-6 h-16 w-auto dark:invert"
          />
          {children}
        </div>
      </div>
    </div>
  )
}
