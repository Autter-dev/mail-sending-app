"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { BlockEditor } from "@/components/editor/BlockEditor"
import type { Block } from "@/lib/db/schema"

interface Campaign {
  id: string
  name: string
  subject: string
  fromName: string
  fromEmail: string
  listId: string
  providerId: string | null
  templateJson: Block[]
  status: string
}

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const campaignId = params.campaignId as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [blocks, setBlocks] = useState<Block[]>([])

  // Test send
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  // Merge tags
  const mergeTags = ["{{email}}", "{{first_name}}", "{{last_name}}"]

  // Auto-save timer
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasChangesRef = useRef(false)

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/campaigns/${campaignId}`)
      if (!res.ok) {
        toast({ title: "Error", description: "Campaign not found", variant: "destructive" })
        router.push("/campaigns")
        return
      }
      const data = await res.json()
      setCampaign(data)
      setName(data.name)
      setSubject(data.subject || "")
      setFromName(data.fromName || "")
      setFromEmail(data.fromEmail || "")
      setBlocks(data.templateJson || [])
    } catch {
      toast({ title: "Error", description: "Failed to load campaign", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [campaignId, router, toast])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  const saveDraft = useCallback(async () => {
    if (!campaign) return
    setSaving(true)
    try {
      const res = await fetch(`/api/internal/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          fromName,
          fromEmail,
          templateJson: blocks,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      hasChangesRef.current = false
      toast({ title: "Saved", description: "Draft saved successfully" })
    } catch {
      toast({ title: "Error", description: "Failed to save draft", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [campaign, campaignId, name, subject, fromName, fromEmail, blocks, toast])

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (hasChangesRef.current && campaign) {
        saveDraft()
      }
    }, 30000)

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [saveDraft, campaign])

  // Track changes
  useEffect(() => {
    if (campaign) {
      hasChangesRef.current = true
    }
  }, [name, subject, fromName, fromEmail, blocks, campaign])

  const handleTestSend = async () => {
    if (!testEmail) return
    setSendingTest(true)
    try {
      const res = await fetch(`/api/internal/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to send test email", variant: "destructive" })
        return
      }
      toast({ title: "Sent", description: `Test email sent to ${testEmail}` })
      setTestDialogOpen(false)
      setTestEmail("")
    } catch {
      toast({ title: "Error", description: "Failed to send test email", variant: "destructive" })
    } finally {
      setSendingTest(false)
    }
  }

  const copyMergeTag = (tag: string) => {
    navigator.clipboard.writeText(tag)
    toast({ title: "Copied", description: `${tag} copied to clipboard` })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Campaign not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Top Bar */}
      <div className="border-b bg-white px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Link
              href={`/campaigns/${campaignId}`}
              className="text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              &larr; Back
            </Link>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-semibold text-lg border-0 bg-transparent p-0 h-auto focus-visible:ring-0 max-w-xs"
              placeholder="Campaign name"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Send Test
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Test Email</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>Recipient Email</Label>
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleTestSend}
                    disabled={!testEmail || sendingTest}
                  >
                    {sendingTest ? "Sending..." : "Send Test"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={saveDraft} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </div>

        {/* Subject and From fields */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <Label className="text-xs text-muted-foreground">Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">From Name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your Name"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">From Email</Label>
            <Input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Block Editor */}
      <div className="flex-1 overflow-hidden">
        <BlockEditor blocks={blocks} onChange={setBlocks} />
      </div>

      {/* Bottom Bar: Merge Tags */}
      <div className="border-t bg-white px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Merge tags:</span>
          {mergeTags.map((tag) => (
            <button
              key={tag}
              onClick={() => copyMergeTag(tag)}
              className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
