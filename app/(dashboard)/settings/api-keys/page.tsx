"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"

interface ApiKey {
  id: string
  name: string
  lastUsedAt: string | null
  rateLimitPerMinute: number
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLimit, setEditLimit] = useState<string>("")
  const [editSaving, setEditSaving] = useState(false)

  const { toast } = useToast()

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/internal/api-keys")
      if (res.ok) setKeys(await res.json())
    } catch {
      toast({ title: "Failed to load API keys", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKeys() }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/internal/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: data.error || "Failed to create key", variant: "destructive" })
        return
      }
      const data = await res.json()
      setNewKey(data.key)
      setName("")
      fetchKeys()
    } catch {
      toast({ title: "Failed to create key", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/internal/api-keys/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "API key deleted" })
        fetchKeys()
      }
    } catch {
      toast({ title: "Failed to delete key", variant: "destructive" })
    } finally {
      setDeleteId(null)
    }
  }

  const handleSaveLimit = async () => {
    if (!editingId) return
    const value = parseInt(editLimit, 10)
    if (Number.isNaN(value) || value < 1) {
      toast({ title: "Enter a number greater than 0", variant: "destructive" })
      return
    }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/internal/api-keys/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateLimitPerMinute: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ title: data.error || "Failed to update rate limit", variant: "destructive" })
        return
      }
      toast({ title: "Rate limit updated" })
      setEditingId(null)
      fetchKeys()
    } catch {
      toast({ title: "Failed to update rate limit", variant: "destructive" })
    } finally {
      setEditSaving(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys for programmatic access.
          </p>
        </div>
        <Dialog
          open={createOpen || newKey !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false)
              setNewKey(null)
              setName("")
            } else {
              setCreateOpen(true)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>Create Key</Button>
          </DialogTrigger>
          <DialogContent>
            {newKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Copy this key now. It will not be shown again.
                  </p>
                  <div className="flex gap-2">
                    <Input value={newKey} readOnly className="font-mono text-sm" />
                    <Button variant="outline" onClick={() => copyToClipboard(newKey)}>
                      Copy
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setNewKey(null); setCreateOpen(false) }}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g. Production, CI/CD"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={saving || !name.trim()}>
                    {saving ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-muted-foreground">
          No API keys yet. Create one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Requests / min</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(key.id)
                      setEditLimit(String(key.rateLimitPerMinute))
                    }}
                  >
                    {key.rateLimitPerMinute} / min
                  </Button>
                </TableCell>
                <TableCell>
                  {key.lastUsedAt ? format(new Date(key.lastUsedAt), "MMM d, yyyy HH:mm") : "Never"}
                </TableCell>
                <TableCell>{format(new Date(key.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive/80"
                    onClick={() => setDeleteId(key.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit rate limit dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rate Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-limit">Requests per minute</Label>
              <Input
                id="edit-limit"
                type="number"
                min={1}
                max={100000}
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Token bucket capacity, refills at this rate per minute. The bucket is reset to full when you save.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveLimit} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? Any applications using this key will lose access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
