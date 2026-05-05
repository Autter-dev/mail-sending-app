"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { UnsubscribePageEditor } from "@/components/settings/UnsubscribePageEditor"
import type { UnsubscribePageContent } from "@/lib/db/schema"

interface AppSettings {
  id: string
  confirmationFromEmail: string | null
  confirmationFromName: string | null
  unsubscribePage: UnsubscribePageContent | null
  updatedAt: string
}

export default function GeneralSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmationFromEmail, setConfirmationFromEmail] = useState("")
  const [confirmationFromName, setConfirmationFromName] = useState("")
  const [unsubscribePage, setUnsubscribePage] = useState<UnsubscribePageContent | null>(null)

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch("/api/internal/settings")
      if (!res.ok) throw new Error("Failed to fetch settings")
      const data: AppSettings = await res.json()
      setConfirmationFromEmail(data.confirmationFromEmail ?? "")
      setConfirmationFromName(data.confirmationFromName ?? "")
      setUnsubscribePage(data.unsubscribePage ?? null)
    } catch {
      toast({
        title: "Error",
        description: "Could not load settings. Please refresh.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/internal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationFromEmail: confirmationFromEmail.trim() || null,
          confirmationFromName: confirmationFromName.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save settings")
      }
      toast({ title: "Settings saved", description: "Your changes have been applied." })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong."
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">General Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Application-wide settings for transactional emails and public-facing pages.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : (
        <>
        <div className="border rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Double opt-in confirmation</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sender used when sending double opt-in confirmation emails. Confirmation emails go through your default email provider.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmation-from-email">Confirmation from email</Label>
            <Input
              id="confirmation-from-email"
              type="email"
              placeholder="confirm@yourdomain.com"
              value={confirmationFromEmail}
              onChange={(e) => setConfirmationFromEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must be on a domain verified with your default email provider. Leave blank to fall back to the CONFIRMATION_FROM_EMAIL environment variable.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmation-from-name">Confirmation from name</Label>
            <Input
              id="confirmation-from-name"
              placeholder="Your Brand"
              value={confirmationFromName}
              onChange={(e) => setConfirmationFromName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Display name shown to recipients. Leave blank to use APP_NAME.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
        <UnsubscribePageEditor initial={unsubscribePage} />
        </>
      )}
    </div>
  )
}
