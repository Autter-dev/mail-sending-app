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
import { HtmlEditor } from "@/components/editor/HtmlEditor"
import type { Block } from "@/lib/db/schema"

type EditorMode = "visual" | "code"

interface Template {
  id: string
  name: string
  description: string | null
  subject: string
  fromName: string
  fromEmail: string
  templateJson: Block[]
  templateHtml: string | null
}

const DEFAULT_MERGE_TAGS = [
  { tag: "{{first_name}}", description: "Recipient's first name" },
  { tag: "{{last_name}}", description: "Recipient's last name" },
  { tag: "{{email}}", description: "Recipient's email" },
  { tag: "{{unsubscribe_url}}", description: "Unsubscribe link" },
]

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const templateId = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editorMode, setEditorMode] = useState<EditorMode>("visual")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [subject, setSubject] = useState("")
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [templateHtml, setTemplateHtml] = useState("")

  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasChangesRef = useRef(false)

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/templates/${templateId}`)
      if (!res.ok) {
        toast({ title: "Error", description: "Template not found", variant: "destructive" })
        router.push("/templates")
        return
      }
      const data: Template = await res.json()
      setTemplate(data)
      setName(data.name)
      setDescription(data.description ?? "")
      setSubject(data.subject || "")
      setFromName(data.fromName || "")
      setFromEmail(data.fromEmail || "")
      setBlocks(data.templateJson || [])
      setTemplateHtml(data.templateHtml || "")
      if (data.templateHtml && (!data.templateJson || data.templateJson.length === 0)) {
        setEditorMode("code")
      }
    } catch {
      toast({ title: "Error", description: "Failed to load template", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [templateId, router, toast])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  const saveDraft = useCallback(async () => {
    if (!template) return
    setSaving(true)
    try {
      const res = await fetch(`/api/internal/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          subject,
          fromName,
          fromEmail,
          templateJson: blocks,
          templateHtml: templateHtml || null,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      hasChangesRef.current = false
      toast({ title: "Saved", description: "Template saved" })
    } catch {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [template, templateId, name, description, subject, fromName, fromEmail, blocks, templateHtml, toast])

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (hasChangesRef.current && template) {
        saveDraft()
      }
    }, 30000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [saveDraft, template])

  useEffect(() => {
    if (template) {
      hasChangesRef.current = true
    }
  }, [name, description, subject, fromName, fromEmail, blocks, templateHtml, template])

  const handleTestSend = async () => {
    if (!testEmail) return
    setSendingTest(true)
    try {
      const res = await fetch(`/api/internal/templates/${templateId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to send test email", variant: "destructive" })
        return
      }
      const sentList: string[] = data.sent || []
      const failedList: { email: string; error: string }[] = data.failed || []
      const sentMsg = sentList.length > 0
        ? `Sent to ${sentList.length} recipient${sentList.length === 1 ? "" : "s"}`
        : "Sent"
      if (failedList.length > 0) {
        toast({
          title: "Partial success",
          description: `${sentMsg}. Failed: ${failedList.map((f) => f.email).join(", ")}`,
          variant: "destructive",
        })
      } else {
        toast({ title: "Sent", description: sentMsg })
      }
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

  if (!template) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Template not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="border-b bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Link
              href="/templates"
              className="text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              &larr; Templates
            </Link>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-semibold text-lg border-0 bg-transparent p-0 h-auto focus-visible:ring-0 max-w-xs"
              placeholder="Template name"
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
                    <Label>Recipient Emails</Label>
                    <Input
                      type="text"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com, another@example.com"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Separate multiple addresses with commas. Up to 10 recipients. Uses the default provider.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleTestSend} disabled={!testEmail || sendingTest}>
                    {sendingTest ? "Sending..." : "Send Test"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={saveDraft} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 mb-2">
          <button
            onClick={() => setEditorMode("visual")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editorMode === "visual"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Visual Editor
          </button>
          <button
            onClick={() => setEditorMode("code")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editorMode === "code"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            HTML Code
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Default Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Default From Name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your Name"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Default From Email</Label>
            <Input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {editorMode === "visual" ? (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        ) : (
          <HtmlEditor html={templateHtml} onChange={setTemplateHtml} />
        )}
      </div>

      <div className="border-t bg-card px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Merge tags:</span>
          {DEFAULT_MERGE_TAGS.map((item) => (
            <button
              key={item.tag}
              onClick={() => copyMergeTag(item.tag)}
              title={item.description}
              className="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-mono transition-colors"
            >
              {item.tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
