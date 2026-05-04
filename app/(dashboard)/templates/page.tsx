"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import type { Block } from "@/lib/db/schema"

interface Template {
  id: string
  name: string
  description: string | null
  subject: string
  fromName: string
  fromEmail: string
  templateJson: Block[]
  templateHtml: string | null
  createdAt: string
  updatedAt: string
}

interface ListOption {
  id: string
  name: string
}

// Minimal client-side block renderer for thumbnail previews. Mirrors lib/renderer
// but avoids pulling Handlebars and juice into the client bundle.
function renderBlocksForPreview(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const p = (block.props || {}) as Record<string, string>
      switch (block.type) {
        case "heading":
          return `<h2 style="font-family:sans-serif;font-size:${p.fontSize || "24px"};color:${p.color || "#111827"};margin:0 0 16px 0;">${p.text || ""}</h2>`
        case "text":
          return `<p style="font-family:sans-serif;font-size:${p.fontSize || "16px"};color:${p.color || "#374151"};margin:0 0 16px 0;line-height:1.6;">${p.text || ""}</p>`
        case "button":
          return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="${p.align || "center"}" style="padding:8px 0;"><a href="${p.url || "#"}" style="display:inline-block;background:${p.bgColor || "#2563eb"};color:${p.textColor || "#ffffff"};font-family:sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">${p.text || "Click here"}</a></td></tr></table>`
        case "image":
          return `<img src="${p.src || ""}" alt="${p.alt || ""}" width="${p.width || "100%"}" style="display:block;max-width:100%;border:0;" />`
        case "divider":
          return `<hr style="border:none;border-top:1px solid ${p.color || "#e5e7eb"};margin:24px 0;" />`
        case "spacer":
          return `<div style="height:${p.height || "24px"};"></div>`
        default:
          return ""
      }
    })
    .join("\n")
}

function buildPreviewSrcDoc(template: Template): string {
  const inner =
    template.templateHtml && template.templateHtml.trim().length > 0
      ? template.templateHtml
      : renderBlocksForPreview(template.templateJson || [])
  if (!inner.trim()) {
    return `<html><body style="margin:0;padding:24px;font-family:sans-serif;color:#9ca3af;background:#f9fafb;">Empty template</body></html>`
  }
  return `<html><body style="margin:0;padding:32px 28px;background:#ffffff;font-family:sans-serif;">${inner}</body></html>`
}

function TemplateThumbnail({ template }: { template: Template }) {
  const srcDoc = useMemo(() => buildPreviewSrcDoc(template), [template])
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md border bg-white">
      <iframe
        title={`Preview of ${template.name}`}
        srcDoc={srcDoc}
        scrolling="no"
        sandbox=""
        className="pointer-events-none origin-top-left border-0"
        style={{
          width: "250%",
          height: "250%",
          transform: "scale(0.4)",
        }}
      />
    </div>
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<Template[]>([])
  const [lists, setLists] = useState<ListOption[]>([])
  const [loading, setLoading] = useState(true)

  // New template dialog
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [creating, setCreating] = useState(false)

  // Use template dialog
  const [useOpen, setUseOpen] = useState(false)
  const [useTemplate, setUseTemplate] = useState<Template | null>(null)
  const [useCampaignName, setUseCampaignName] = useState("")
  const [useListId, setUseListId] = useState("")
  const [using, setUsing] = useState(false)

  // Rename dialog
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTemplate, setRenameTemplate] = useState<Template | null>(null)
  const [renameName, setRenameName] = useState("")
  const [renameDescription, setRenameDescription] = useState("")

  async function load() {
    setLoading(true)
    try {
      const [tplRes, listsRes] = await Promise.all([
        fetch("/api/internal/templates"),
        fetch("/api/internal/lists"),
      ])
      if (!tplRes.ok || !listsRes.ok) {
        toast({ title: "Failed to load data", variant: "destructive" })
        return
      }
      setTemplates(await tplRes.json())
      setLists(await listsRes.json())
    } catch {
      toast({ title: "An error occurred while loading templates", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openNew() {
    setNewName("")
    setNewDescription("")
    setNewOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: "Template name is required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/internal/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: err.error || "Failed to create template", variant: "destructive" })
        return
      }
      const created = await res.json()
      setNewOpen(false)
      router.push(`/templates/${created.id}/edit`)
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  function openUse(template: Template) {
    setUseTemplate(template)
    setUseCampaignName(template.name)
    setUseListId("")
    setUseOpen(true)
  }

  async function handleUse() {
    if (!useTemplate) return
    if (!useCampaignName.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" })
      return
    }
    if (!useListId) {
      toast({ title: "Please select a list", variant: "destructive" })
      return
    }
    setUsing(true)
    try {
      const res = await fetch(`/api/internal/templates/${useTemplate.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: useCampaignName.trim(), listId: useListId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: err.error || "Failed to create campaign", variant: "destructive" })
        return
      }
      const created = await res.json()
      setUseOpen(false)
      router.push(`/editor/${created.id}`)
    } catch {
      toast({ title: "Failed to create campaign", variant: "destructive" })
    } finally {
      setUsing(false)
    }
  }

  function openRename(template: Template) {
    setRenameTemplate(template)
    setRenameName(template.name)
    setRenameDescription(template.description ?? "")
    setRenameOpen(true)
  }

  async function handleRename() {
    if (!renameTemplate) return
    if (!renameName.trim()) {
      toast({ title: "Template name is required", variant: "destructive" })
      return
    }
    try {
      const res = await fetch(`/api/internal/templates/${renameTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: renameName.trim(),
          description: renameDescription.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: err.error || "Failed to rename template", variant: "destructive" })
        return
      }
      setRenameOpen(false)
      await load()
    } catch {
      toast({ title: "Failed to rename template", variant: "destructive" })
    }
  }

  async function handleDelete(template: Template) {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/internal/templates/${template.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: err.error || "Failed to delete template", variant: "destructive" })
        return
      }
      toast({ title: "Template deleted" })
      await load()
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable layouts. Save any campaign as a template, start new campaigns from one.
          </p>
        </div>
        <Button onClick={openNew}>New Template</Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <p className="text-lg font-medium">No templates yet</p>
          <p className="text-sm mt-1">
            Create a template, or save an existing campaign as one.
          </p>
          <Button className="mt-4" onClick={openNew}>
            New Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border bg-card overflow-hidden flex flex-col"
            >
              <Link
                href={`/templates/${template.id}/edit`}
                className="block hover:opacity-90 transition-opacity"
              >
                <TemplateThumbnail template={template} />
              </Link>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/templates/${template.id}/edit`}
                    className="font-semibold leading-snug hover:text-primary transition-colors line-clamp-1"
                  >
                    {template.name}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRename(template)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(template)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {template.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-auto pt-2">
                  Updated {format(new Date(template.updatedAt), "MMM d, yyyy")}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => openUse(template)}
                  >
                    Use
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/templates/${template.id}/edit`}>Edit</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New template dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Monthly Newsletter"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-description">Description (optional)</Label>
              <Input
                id="tpl-description"
                placeholder="Short note about this template"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use template dialog */}
      <Dialog open={useOpen} onOpenChange={setUseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Campaign From Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="use-name">Campaign Name</Label>
              <Input
                id="use-name"
                placeholder="e.g. April Newsletter"
                value={useCampaignName}
                onChange={(e) => setUseCampaignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="use-list">List</Label>
              <Select value={useListId} onValueChange={setUseListId}>
                <SelectTrigger id="use-list">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No lists available
                    </SelectItem>
                  ) : (
                    lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseOpen(false)} disabled={using}>
              Cancel
            </Button>
            <Button onClick={handleUse} disabled={using}>
              {using ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-description">Description</Label>
              <Input
                id="rename-description"
                value={renameDescription}
                onChange={(e) => setRenameDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
