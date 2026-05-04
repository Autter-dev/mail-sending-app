'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import type { Block, Form, FormField, FormFieldType } from '@/lib/db/schema'
import { BlockEditor } from '@/components/editor/BlockEditor'

interface ListOption { id: string; name: string }
interface ProviderOption { id: string; name: string; isDefault: boolean }

interface BuilderProps {
  form: Form
  lists: ListOption[]
  providers: ProviderOption[]
  appUrl: string
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'field'
}

export function Builder({ form, lists, providers, appUrl }: BuilderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(form.name)
  const [listId, setListId] = useState(form.listId)
  const [providerId, setProviderId] = useState<string | null>(form.providerId ?? null)
  const [fromName, setFromName] = useState(form.fromName)
  const [fromEmail, setFromEmail] = useState(form.fromEmail)
  const [doubleOptIn, setDoubleOptIn] = useState(form.doubleOptIn)
  const [confirmationSubject, setConfirmationSubject] = useState(form.confirmationSubject)
  const [confirmationTemplateJson, setConfirmationTemplateJson] = useState<Block[]>(
    Array.isArray(form.confirmationTemplateJson) ? form.confirmationTemplateJson : [],
  )
  const [successMessage, setSuccessMessage] = useState(form.successMessage)
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl ?? '')
  const [fields, setFields] = useState<FormField[]>(
    Array.isArray(form.fields) && form.fields.length > 0
      ? form.fields
      : [{ id: nanoid(), key: 'email', label: 'Email', type: 'email', required: true }],
  )
  const [saving, setSaving] = useState(false)

  const hostedUrl = `${appUrl}/f/${form.id}`
  const embedSnippet = `<script src="${appUrl}/api/public/forms/${form.id}/embed.js" data-form-id="${form.id}" async></script>`
  const iframeSnippet = `<script src="${appUrl}/api/public/forms/${form.id}/embed.js" data-form-id="${form.id}" data-mode="iframe" async></script>`

  const emailField = fields.find((f) => f.type === 'email')

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }
  function addField(type: FormFieldType) {
    if (type === 'email') return
    const baseLabel = type === 'checkbox' ? 'I agree' : type === 'select' ? 'Choose one' : 'New field'
    const baseKey =
      type === 'text' ? `field_${fields.length}` : type === 'select' ? `select_${fields.length}` : `consent_${fields.length}`
    setFields((prev) => [
      ...prev,
      {
        id: nanoid(),
        key: baseKey,
        label: baseLabel,
        type,
        required: false,
        options: type === 'select' ? ['Option 1'] : undefined,
      },
    ])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/internal/forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          listId,
          providerId: providerId || null,
          fromName,
          fromEmail,
          fields,
          doubleOptIn,
          confirmationSubject,
          confirmationTemplateJson,
          successMessage,
          redirectUrl: redirectUrl.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      toast({ title: 'Form saved' })
      router.refresh()
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    )
  }

  const previewFields = useMemo(() => fields, [fields])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/forms" className="text-sm text-muted-foreground hover:underline">
            ← Back to forms
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-semibold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="fields">
            <TabsList>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="confirmation" disabled={!doubleOptIn}>
                Confirmation Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-3 pt-4">
              {fields.map((field) => (
                <div key={field.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {field.type}
                    </span>
                    {field.type !== 'email' && (
                      <Button variant="ghost" size="sm" onClick={() => removeField(field.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const label = e.target.value
                          updateField(field.id, {
                            label,
                            key: field.type === 'email' ? 'email' : slugify(label),
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label>Key</Label>
                      <Input
                        value={field.key}
                        onChange={(e) => updateField(field.id, { key: slugify(e.target.value) })}
                        disabled={field.type === 'email'}
                      />
                    </div>
                  </div>
                  {field.type === 'select' && (
                    <div>
                      <Label>Options (one per line)</Label>
                      <Textarea
                        value={(field.options ?? []).join('\n')}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={4}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      disabled={field.type === 'email'}
                    />
                    Required
                  </label>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => addField('text')}>
                  + Text
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addField('checkbox')}>
                  + Checkbox
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addField('select')}>
                  + Select
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 pt-4">
              <div>
                <Label>List</Label>
                <select
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Success message</Label>
                <Textarea
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label>Redirect URL (optional)</Label>
                <Input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://example.com/thanks"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If set, the form redirects here on success instead of showing the success message.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={doubleOptIn}
                    onChange={(e) => setDoubleOptIn(e.target.checked)}
                  />
                  Require email confirmation (double opt-in)
                </label>
                {doubleOptIn && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <Label>Email provider</Label>
                      <select
                        value={providerId ?? ''}
                        onChange={(e) => setProviderId(e.target.value || null)}
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Use default provider</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>From name</Label>
                        <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
                      </div>
                      <div>
                        <Label>From email</Label>
                        <Input
                          value={fromEmail}
                          onChange={(e) => setFromEmail(e.target.value)}
                          placeholder="hello@example.com"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="confirmation" className="space-y-4 pt-4">
              <div>
                <Label>Confirmation subject</Label>
                <Input
                  value={confirmationSubject}
                  onChange={(e) => setConfirmationSubject(e.target.value)}
                  placeholder="Please confirm your subscription"
                />
              </div>
              <div>
                <Label>Confirmation email body</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Use the merge tag <code className="font-mono">{'{{confirm_url}}'}</code> in a button URL.
                </p>
                <BlockEditor
                  blocks={confirmationTemplateJson}
                  onChange={setConfirmationTemplateJson}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Preview</h3>
            <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
              {previewFields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </div>
                  {field.type === 'checkbox' ? (
                    <input type="checkbox" disabled />
                  ) : field.type === 'select' ? (
                    <select disabled className="w-full rounded border bg-background px-2 py-1 text-xs">
                      <option>Select...</option>
                    </select>
                  ) : (
                    <input
                      disabled
                      type={field.type === 'email' ? 'email' : 'text'}
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                    />
                  )}
                </div>
              ))}
              <button
                disabled
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground opacity-70"
              >
                Subscribe
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Hosted URL</h3>
            <div className="flex gap-2">
              <Input readOnly value={hostedUrl} />
              <Button variant="secondary" onClick={() => copy(hostedUrl, 'URL')}>
                Copy
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Embed snippet (DOM)</h3>
            <Textarea readOnly rows={2} value={embedSnippet} className="font-mono text-xs" />
            <Button variant="secondary" size="sm" onClick={() => copy(embedSnippet, 'Snippet')}>
              Copy snippet
            </Button>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Embed snippet (iframe)</h3>
            <Textarea readOnly rows={2} value={iframeSnippet} className="font-mono text-xs" />
            <Button variant="secondary" size="sm" onClick={() => copy(iframeSnippet, 'Snippet')}>
              Copy snippet
            </Button>
          </div>

          {emailField ? null : (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              An email field is required.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
