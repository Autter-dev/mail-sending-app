'use client'

import { useState, useRef, useCallback } from 'react'
import { html as beautifyHtml } from 'js-beautify'
import { Button } from '@/components/ui/button'
import { Upload, WrapText } from 'lucide-react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface HtmlEditorProps {
  html: string
  onChange: (html: string) => void
}

export function HtmlEditor({ html, onChange }: HtmlEditorProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const insertAtCursor = useCallback((text: string) => {
    const editor = editorRef.current
    if (!editor) {
      onChange(html + text)
      return
    }
    const selection = editor.getSelection()
    if (selection) {
      editor.executeEdits('insert', [{ range: selection, text }])
    }
    editor.focus()
  }, [html, onChange])

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/internal/images', {
        method: 'POST',
        body: formData,
      })
      if (res.redirected || res.url.includes('/login') || res.url.includes('/signin')) {
        alert('Session expired. Please refresh the page and log in again.')
        return
      }
      const text = await res.text()
      let data: { url?: string; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        alert(`Upload failed: unexpected response`)
        return
      }
      if (!res.ok) {
        alert(data.error || `Upload failed (${res.status})`)
        return
      }
      const imgTag = `<img src="${data.url}" alt="" style="display:block;max-width:100%;" />`
      insertAtCursor(imgTag)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    e.target.value = ''
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Code editor */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">
        <div className="px-4 py-2 border-b bg-card flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">HTML Code</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-3 w-3" />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                const formatted = beautifyHtml(html, {
                  indent_size: 2,
                  wrap_line_length: 120,
                  preserve_newlines: true,
                  max_preserve_newlines: 2,
                  indent_inner_html: true,
                })
                onChange(formatted)
              }}
            >
              <WrapText className="h-3 w-3" />
              Format
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Merge tags: {'{{email}}'}, {'{{first_name}}'}, {'{{unsubscribe_url}}'}
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="html"
            value={html}
            onChange={(value) => onChange(value || '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 21,
              tabSize: 2,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16 },
            }}
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b bg-card flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Preview</p>
          <div className="flex gap-1">
            <Button
              variant={previewMode === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreviewMode('desktop')}
            >
              Desktop
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreviewMode('mobile')}
            >
              Mobile
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-muted/50 p-4 flex justify-center">
          <iframe
            srcDoc={html || '<p style="color:#999;font-family:sans-serif;text-align:center;padding:40px;">HTML preview will appear here</p>'}
            className="bg-card shadow-warm rounded-lg border-0"
            style={{
              width: previewMode === 'desktop' ? '600px' : '375px',
              height: '100%',
              maxWidth: '100%',
            }}
            title="HTML Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
