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

export function HeadingBlock({ props, onChange }: BlockEditorProps) {
  const text = (props.text as string) ?? ''
  const fontSize = (props.fontSize as string) ?? '24px'
  const color = (props.color as string) ?? '#111827'
  const align = (props.align as string) ?? 'left'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="heading-text">Heading Text</Label>
        <Input
          id="heading-text"
          value={text}
          onChange={(e) => onChange({ ...props, text: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="heading-font-size">Font Size</Label>
        <Select
          value={fontSize}
          onValueChange={(value) => onChange({ ...props, fontSize: value })}
        >
          <SelectTrigger id="heading-font-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20px">20px</SelectItem>
            <SelectItem value="24px">24px</SelectItem>
            <SelectItem value="28px">28px</SelectItem>
            <SelectItem value="32px">32px</SelectItem>
            <SelectItem value="36px">36px</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="heading-color">Color</Label>
        <Input
          id="heading-color"
          type="color"
          value={color}
          onChange={(e) => onChange({ ...props, color: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="heading-align">Alignment</Label>
        <Select
          value={align}
          onValueChange={(value) => onChange({ ...props, align: value })}
        >
          <SelectTrigger id="heading-align">
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
