'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function ButtonBlock({ props, onChange }: BlockEditorProps) {
  const text = (props.text as string) ?? 'Click here'
  const url = (props.url as string) ?? ''
  const bgColor = (props.bgColor as string) ?? '#2563eb'
  const textColor = (props.textColor as string) ?? '#ffffff'
  const align = (props.align as string) ?? 'center'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="button-text">Button Text</Label>
        <Input
          id="button-text"
          value={text}
          onChange={(e) => onChange({ ...props, text: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="button-url">URL</Label>
        <Input
          id="button-url"
          value={url}
          placeholder="https://..."
          onChange={(e) => onChange({ ...props, url: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="button-bg-color">Background Color</Label>
        <Input
          id="button-bg-color"
          type="color"
          value={bgColor}
          onChange={(e) => onChange({ ...props, bgColor: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="button-text-color">Text Color</Label>
        <Input
          id="button-text-color"
          type="color"
          value={textColor}
          onChange={(e) => onChange({ ...props, textColor: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="button-align">Alignment</Label>
        <Select
          value={align}
          onValueChange={(value) => onChange({ ...props, align: value })}
        >
          <SelectTrigger id="button-align">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
