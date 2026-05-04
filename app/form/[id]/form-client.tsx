'use client'

import { useState } from 'react'
import type { FormField } from '@/lib/db/schema'

interface Props {
  formId: string
  name: string
  fields: FormField[]
  successMessage: string
  redirectUrl: string | null
}

export function FormClient({ formId, fields, successMessage, redirectUrl }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const fd = new FormData(e.currentTarget)
    const body = new URLSearchParams()
    fd.forEach((v, k) => {
      if (typeof v === 'string') body.append(k, v)
    })

    try {
      const res = await fetch(`/api/public/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        credentials: 'omit',
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error || 'Submission failed')
        setSubmitting(false)
        return
      }
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }
      setSuccess(json.message || successMessage)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-primary/10 p-4 text-sm text-foreground">{success}</div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {fields.map((field) => (
        <FieldInput key={field.id} field={field} />
      ))}
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, height: 1, width: 1 }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Subscribe'}
      </button>
      {redirectUrl ? null : null}
    </form>
  )
}

function FieldInput({ field }: { field: FormField }) {
  const labelText = `${field.label}${field.required ? ' *' : ''}`
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={field.key}
          value="1"
          required={field.required}
          className="h-4 w-4 rounded border border-input"
        />
        <span>{labelText}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground">{labelText}</span>
        <select
          name={field.key}
          required={field.required}
          defaultValue=""
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select...
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-foreground">{labelText}</span>
      <input
        name={field.key}
        type={field.type === 'email' ? 'email' : 'text'}
        autoComplete={field.type === 'email' ? 'email' : 'off'}
        required={field.required}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  )
}
