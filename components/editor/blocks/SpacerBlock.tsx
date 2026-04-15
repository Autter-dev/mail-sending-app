'use client'

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

export function SpacerBlock({ props, onChange }: BlockEditorProps) {
  const height = (props.height as string) ?? '24px'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="spacer-height">Height</Label>
        <Select
          value={height}
          onValueChange={(value) => onChange({ ...props, height: value })}
        >
          <SelectTrigger id="spacer-height">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8px">8px</SelectItem>
            <SelectItem value="16px">16px</SelectItem>
            <SelectItem value="24px">24px</SelectItem>
            <SelectItem value="32px">32px</SelectItem>
            <SelectItem value="48px">48px</SelectItem>
            <SelectItem value="64px">64px</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
