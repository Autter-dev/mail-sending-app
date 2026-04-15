'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BlockEditorProps {
  props: Record<string, unknown>
  onChange: (props: Record<string, unknown>) => void
}

export function ImageBlock({ props, onChange }: BlockEditorProps) {
  const src = (props.src as string) ?? ''
  const alt = (props.alt as string) ?? ''
  const width = (props.width as string) ?? '100%'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="image-src">Image URL</Label>
        <Input
          id="image-src"
          value={src}
          placeholder="https://..."
          onChange={(e) => onChange({ ...props, src: e.target.value })}
        />
      </div>

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
