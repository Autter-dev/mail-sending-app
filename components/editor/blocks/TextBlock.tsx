'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BlockEditorProps {
  props: Record<string, unknown>
  onChange: (props: Record<string, unknown>) => void
}

export function TextBlock({ props, onChange }: BlockEditorProps) {
  const text = (props.text as string) ?? ''
  const fontSize = (props.fontSize as string) ?? '16px'
  const color = (props.color as string) ?? '#374151'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="text-content">Text Content</Label>
        <Textarea
          id="text-content"
          rows={4}
          value={text}
          onChange={(e) => onChange({ ...props, text: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="text-font-size">Font Size</Label>
        <Select
          value={fontSize}
          onValueChange={(value) => onChange({ ...props, fontSize: value })}
        >
          <SelectTrigger id="text-font-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14px">14px</SelectItem>
            <SelectItem value="16px">16px</SelectItem>
            <SelectItem value="18px">18px</SelectItem>
            <SelectItem value="20px">20px</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="text-color">Color</Label>
        <Input
          id="text-color"
          type="color"
          value={color}
          onChange={(e) => onChange({ ...props, color: e.target.value })}
        />
      </div>
    </div>
  )
}
