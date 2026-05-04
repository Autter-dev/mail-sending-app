'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

type Kind = 'all' | 'image' | 'file'

interface AssetRow {
  id: string
  fileId: string
  name: string
  originalName: string
  mimeType: string
  size: number
  kind: 'image' | 'file'
  url: string
  createdAt: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AssetsPage() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>('all')
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [renameTarget, setRenameTarget] = useState<AssetRow | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (kind !== 'all') params.set('kind', kind)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/internal/assets?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load assets')
      const json = await res.json()
      setAssets(json.data)
    } catch {
      toast({ title: 'Error', description: 'Could not load assets.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [kind, search, toast])

  useEffect(() => {
    const t = setTimeout(fetchAssets, 200)
    return () => clearTimeout(t)
  }, [fetchAssets])

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true)
    let success = 0
    let failed = 0
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/')
      // Images keep going through /api/internal/images for the existing flow.
      // Generic files use /api/internal/assets POST.
      const endpoint = isImage ? '/api/internal/images' : '/api/internal/assets'
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(endpoint, { method: 'POST', body: fd })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Upload failed')
        }
        success++
      } catch {
        failed++
      }
    }
    setUploading(false)
    if (success) toast({ title: 'Upload complete', description: `${success} file(s) added.` })
    if (failed) toast({ title: 'Some uploads failed', description: `${failed} file(s) could not be uploaded.`, variant: 'destructive' })
    await fetchAssets()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    try {
      const res = await fetch(`/api/internal/assets/${renameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      if (!res.ok) throw new Error('Rename failed')
      toast({ title: 'Renamed' })
      setRenameTarget(null)
      await fetchAssets()
    } catch {
      toast({ title: 'Error', description: 'Could not rename asset.', variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/internal/assets/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast({ title: 'Deleted' })
      setDeleteTarget(null)
      await fetchAssets()
    } catch {
      toast({ title: 'Error', description: 'Could not delete asset.', variant: 'destructive' })
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'URL copied' })
    } catch {
      toast({ title: 'Error', description: 'Could not copy URL.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Assets</h1>
          <p className="text-muted-foreground mt-1">
            Upload images and files once, reuse them across campaigns.
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="image">Images</TabsTrigger>
            <TabsTrigger value="file">Files</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground hover:border-primary/40 transition-colors"
      >
        Drag and drop files here, or click Upload above. Images max 5MB. Files max 25MB.
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground">No assets yet. Upload your first file above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-lg border border-border overflow-hidden bg-card">
              {asset.kind === 'image' ? (
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-muted flex flex-col items-center justify-center p-4">
                  <span className="text-2xl font-mono uppercase text-muted-foreground">
                    {(asset.mimeType.split('/')[1] || 'file').slice(0, 4)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-2">
                    {formatBytes(asset.size)}
                  </span>
                </div>
              )}
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate" title={asset.name}>
                    {asset.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(asset.size)} | {format(new Date(asset.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copyUrl(asset.url)}>
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameTarget(asset)
                      setRenameValue(asset.name)
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(asset)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-value">Name</Label>
            <Input
              id="rename-value"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete asset?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.name} will be permanently removed. Emails that reference this file
            will no longer load it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
