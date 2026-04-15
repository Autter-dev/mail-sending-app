'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BlockEditorProps {
  props: Record<string, unknown>
  onChange: (props: Record<string, unknown>) => void
}

export function DividerBlock({ props, onChange }: BlockEditorProps) {
  const color = (props.color as string) ?? '#e5e7eb'

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="divider-color">Color</Label>
        <Input
          id="divider-color"
          type="color"
          value={color}
          onChange={(e) => onChange({ ...props, color: e.target.value })}
        />
      </div>
    </div>
  )
}
