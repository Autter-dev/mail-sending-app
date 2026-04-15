'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface BlockEditorProps {
  props: Record<string, unknown>
  onChange: (props: Record<string, unknown>) => void
}

export function ImageBlock({ props, onChange }: BlockEditorProps) {
  const src = (props.src as string) ?? ''
  const alt = (props.alt as string) ?? ''
  const width = (props.width as string) ?? '100%'
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/internal/images', {
        method: 'POST',
        body: formData,
      })
      // Handle redirect (auth failure)
      if (res.redirected || res.url.includes('/login') || res.url.includes('/signin')) {
        setUploadError('Session expired. Please refresh the page and log in again.')
        return
      }
      const text = await res.text()
      let data: { url?: string; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        setUploadError(`Upload failed: unexpected response`)
        return
      }
      if (!res.ok) {
        setUploadError(data.error || `Upload failed (${res.status})`)
        return
      }
      onChange({ ...props, src: data.url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file)
    }
  }

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div>
        <Label>Upload Image</Label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="mt-1 border-2 border-dashed border-slate-200 rounded-md p-4 text-center hover:border-slate-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <p className="text-sm text-muted-foreground">Uploading...</p>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                Click or drag an image here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPEG, GIF, WebP, SVG. Max 5MB.
              </p>
            </div>
          )}
        </div>
        {uploadError && (
          <p className="text-xs text-red-500 mt-1">{uploadError}</p>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <div>
        <Label htmlFor="image-src">Image URL</Label>
        <Input
          id="image-src"
          value={src}
          placeholder="https://..."
          onChange={(e) => onChange({ ...props, src: e.target.value })}
        />
      </div>

      {src && (
        <div className="rounded border p-2">
          <img
            src={src}
            alt={alt || 'Preview'}
            className="max-h-32 mx-auto object-contain"
          />
        </div>
      )}

      <div>
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          value={alt}
          onChange={(e) => onChange({ ...props, alt: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="image-width">Width</Label>
        <Input
          id="image-width"
          value={width}
          placeholder="100%"
          onChange={(e) => onChange({ ...props, width: e.target.value })}
        />
      </div>
    </div>
  )
}
