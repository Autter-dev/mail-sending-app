'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export interface PickerAsset {
  id: string
  fileId: string
  name: string
  url: string
  kind: 'image' | 'file'
  mimeType: string
  size: number
  createdAt: string
}

interface AssetPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: 'image' | 'file'
  onSelect: (asset: PickerAsset) => void
}

export function AssetPicker({ open, onOpenChange, kind = 'image', onSelect }: AssetPickerProps) {
  const [assets, setAssets] = useState<PickerAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ limit: '60', kind })
    if (search.trim()) params.set('search', search.trim())
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/internal/assets?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load assets')
        const json = await res.json()
        if (!cancelled) setAssets(json.data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, kind, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose from library</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No assets found. Upload from the Assets page.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset)
                    onOpenChange(false)
                  }}
                  className="group rounded border border-border hover:border-primary overflow-hidden text-left"
                >
                  {asset.kind === 'image' ? (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground uppercase">
                        {asset.mimeType.split('/')[1] || 'file'}
                      </span>
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs truncate" title={asset.name}>
                      {asset.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
