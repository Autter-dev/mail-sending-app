'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { createHighlighter, type Highlighter } from 'shiki'

interface HtmlEditorProps {
  html: string
  onChange: (html: string) => void
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: ['html'],
    })
  }
  return highlighterPromise
}

export function HtmlEditor({ html, onChange }: HtmlEditorProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [uploading, setUploading] = useState(false)
  const [highlightedHtml, setHighlightedHtml] = useState('')
  const [highlighterReady, setHighlighterReady] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const highlighterRef = useRef<Highlighter | null>(null)

  // Initialize shiki highlighter
  useEffect(() => {
    getHighlighter().then((h) => {
      highlighterRef.current = h
      setHighlighterReady(true)
    })
  }, [])

  // Highlight code when html or highlighter changes
  useEffect(() => {
    if (!highlighterRef.current) return
    const result = highlighterRef.current.codeToHtml(html || ' ', {
      lang: 'html',
      theme: 'github-dark',
    })
    setHighlightedHtml(result)
  }, [html, highlighterReady])

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const highlight = highlightRef.current
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop
      highlight.scrollLeft = textarea.scrollLeft
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = html.substring(0, start) + '  ' + html.substring(end)
        onChange(newValue)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        })
      }
    },
    [html, onChange]
  )

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(html + text)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = html.substring(0, start) + text + html.substring(end)
    onChange(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + text.length
    })
  }

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

  function handleEditorDrop(e: React.DragEvent) {
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      e.preventDefault()
      handleFileUpload(file)
    }
  }

  const lineCount = html.split('\n').length

  return (
    <div className="flex h-full overflow-hidden">
      {/* Code editor */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">
        <div className="px-4 py-2 border-b bg-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-700">HTML Code</p>
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
          </div>
          <p className="text-xs text-muted-foreground">
            Merge tags: {'{{email}}'}, {'{{first_name}}'}, {'{{unsubscribe_url}}'}
          </p>
        </div>
        <div
          className="flex-1 flex overflow-hidden"
          style={{ backgroundColor: '#24292e' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleEditorDrop}
        >
          {/* Line numbers */}
          <div className="w-12 shrink-0 pt-4 select-none overflow-hidden">
            <div
              style={{
                transform: `translateY(-${textareaRef.current?.scrollTop || 0}px)`,
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div
                  key={i}
                  className="text-right pr-3 font-mono"
                  style={{
                    fontSize: '14px',
                    lineHeight: '21px',
                    color: '#6e7681',
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Editor area: highlighted overlay + transparent textarea */}
          <div className="flex-1 relative overflow-hidden">
            {/* Shiki highlighted layer */}
            <div
              ref={highlightRef}
              className="absolute inset-0 overflow-hidden pointer-events-none p-4"
              style={{ zIndex: 0 }}
              dangerouslySetInnerHTML={{
                __html: highlightedHtml
                  // Strip shiki's wrapper styles so we control layout
                  .replace(/<pre[^>]*>/, '<pre style="margin:0;padding:0;background:transparent;overflow:visible;">')
                  .replace(/<code[^>]*>/, '<code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;line-height:21px;tab-size:2;">')
              }}
            />
            {/* Transparent textarea on top for editing */}
            <textarea
              ref={textareaRef}
              value={html}
              onChange={(e) => onChange(e.target.value)}
              onScroll={syncScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none outline-none p-4 overflow-auto"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '14px',
                lineHeight: '21px',
                background: 'transparent',
                color: 'transparent',
                caretColor: '#e1e4e8',
                zIndex: 1,
                tabSize: 2,
                whiteSpace: 'pre',
              }}
              placeholder="<!-- Write your HTML email here -->"
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Preview</p>
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
        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
          <iframe
            srcDoc={html || '<p style="color:#999;font-family:sans-serif;text-align:center;padding:40px;">HTML preview will appear here</p>'}
            className="bg-white shadow rounded border-0"
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
