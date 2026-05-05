"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  UNSUBSCRIBE_PAGE_DEFAULTS,
  mergeUnsubscribePageContent,
  renderUnsubscribeBody,
  renderUnsubscribeTitle,
} from "@/lib/settings/unsubscribe-page"
import type { UnsubscribePageContent, UnsubscribePageStateContent } from "@/lib/db/schema"

type StateKey = keyof UnsubscribePageContent

const STATE_LABELS: Record<StateKey, string> = {
  confirm: "Confirm (initial)",
  confirmed: "Confirmed",
  alreadyUnsubscribed: "Already unsubscribed",
  invalid: "Invalid link",
}

const PREVIEW_VARS = {
  email: "you@example.com",
  list_name: "Newsletter",
  app_name: "hedwig",
}

interface UnsubscribePageEditorProps {
  initial: UnsubscribePageContent | null
}

export function UnsubscribePageEditor({ initial }: UnsubscribePageEditorProps) {
  const { toast } = useToast()
  const [content, setContent] = useState<UnsubscribePageContent>(() =>
    mergeUnsubscribePageContent(initial),
  )
  const [activeState, setActiveState] = useState<StateKey>("confirm")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setContent(mergeUnsubscribePageContent(initial))
  }, [initial])

  function updateState(key: StateKey, patch: Partial<UnsubscribePageStateContent>) {
    setContent((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/internal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsubscribePage: content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save")
      }
      toast({ title: "Unsubscribe page saved", description: "Visitors will see your custom copy." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong."
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!window.confirm("Reset all four states to the default copy? Your customizations will be lost.")) return
    setSaving(true)
    try {
      const res = await fetch("/api/internal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsubscribePage: null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to reset")
      }
      setContent(mergeUnsubscribePageContent(null))
      toast({ title: "Reset to defaults", description: "Default unsubscribe page copy restored." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong."
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const current = content[activeState]
  const previewTitle = useMemo(
    () => renderUnsubscribeTitle(current.title || "", PREVIEW_VARS),
    [current.title],
  )
  const previewBody = useMemo(
    () => renderUnsubscribeBody(current.body || "", PREVIEW_VARS),
    [current.body],
  )

  return (
    <div className="border rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Unsubscribe page</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the copy shown on the public unsubscribe page. Use{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{email}}"}</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{list_name}}"}</code>, and{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{app_name}}"}</code> as merge tags. The body
          supports basic HTML: <code className="text-xs">a, strong, em, br, p, span</code>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {(Object.keys(STATE_LABELS) as StateKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveState(key)}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              activeState === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {STATE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="state-title">Title</Label>
            <Input
              id="state-title"
              value={current.title}
              maxLength={200}
              onChange={(e) => updateState(activeState, { title: e.target.value })}
              placeholder={UNSUBSCRIBE_PAGE_DEFAULTS[activeState].title}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="state-body">Body</Label>
            <Textarea
              id="state-body"
              value={current.body}
              maxLength={2000}
              rows={6}
              onChange={(e) => updateState(activeState, { body: e.target.value })}
              placeholder={UNSUBSCRIBE_PAGE_DEFAULTS[activeState].body}
            />
            <p className="text-xs text-muted-foreground">{current.body.length} / 2000</p>
          </div>

          {activeState === "confirm" && (
            <div className="space-y-1.5">
              <Label htmlFor="state-button">Confirm button label</Label>
              <Input
                id="state-button"
                value={current.buttonLabel ?? ""}
                maxLength={80}
                onChange={(e) => updateState(activeState, { buttonLabel: e.target.value })}
                placeholder={UNSUBSCRIBE_PAGE_DEFAULTS.confirm.buttonLabel}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="bg-background border rounded-xl p-6 min-h-[240px]">
            <div className="bg-card rounded-xl shadow-warm border p-6 text-center">
              <div className="mx-auto mb-4 h-10 w-24 bg-muted rounded flex items-center justify-center text-[10px] uppercase tracking-wide text-muted-foreground">
                logo
              </div>
              <h3 className="text-base font-semibold font-heading text-foreground mb-2">
                {previewTitle || <span className="text-muted-foreground italic">Title</span>}
              </h3>
              <div
                className="text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-medium [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
              {activeState === "confirm" && (
                <button
                  type="button"
                  disabled
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground cursor-default"
                >
                  {current.buttonLabel?.trim() || "Confirm Unsubscribe"}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Preview uses sample values: {PREVIEW_VARS.email}, {PREVIEW_VARS.list_name}.
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          Reset to defaults
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
