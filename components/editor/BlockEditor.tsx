'use client'

import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  Type,
  AlignLeft,
  ImageIcon,
  MousePointerClick,
  Minus,
  MoveVertical,
  GripVertical,
  X,
} from 'lucide-react'
import type { Block, BlockType } from '@/lib/db/schema'
import { HeadingBlock } from '@/components/editor/blocks/HeadingBlock'
import { TextBlock } from '@/components/editor/blocks/TextBlock'
import { ButtonBlock } from '@/components/editor/blocks/ButtonBlock'
import { ImageBlock } from '@/components/editor/blocks/ImageBlock'
import { DividerBlock } from '@/components/editor/blocks/DividerBlock'
import { SpacerBlock } from '@/components/editor/blocks/SpacerBlock'

interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}

interface BlockTypeMeta {
  type: BlockType
  label: string
  icon: React.ReactNode
  defaultProps: Record<string, unknown>
}

const BLOCK_TYPES: BlockTypeMeta[] = [
  {
    type: 'heading',
    label: 'Heading',
    icon: <Type className="h-4 w-4" />,
    defaultProps: { text: 'Heading', fontSize: '24px', color: '#111827', align: 'left' },
  },
  {
    type: 'text',
    label: 'Text',
    icon: <AlignLeft className="h-4 w-4" />,
    defaultProps: { text: 'Enter your text here.', fontSize: '16px', color: '#374151' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: <ImageIcon className="h-4 w-4" />,
    defaultProps: { src: '', alt: '', width: '100%' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: <MousePointerClick className="h-4 w-4" />,
    defaultProps: { text: 'Click here', url: '#', bgColor: '#2563eb', textColor: '#ffffff', align: 'center' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus className="h-4 w-4" />,
    defaultProps: { color: '#e5e7eb' },
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: <MoveVertical className="h-4 w-4" />,
    defaultProps: { height: '24px' },
  },
]

function renderBlockPreview(block: Block): string {
  const p = block.props as Record<string, string>
  switch (block.type) {
    case 'heading':
      return `<h2 style="font-family:sans-serif;font-size:${p.fontSize || '24px'};color:${p.color || '#111827'};margin:0 0 16px 0;text-align:${p.align || 'left'};">${p.text || ''}</h2>`
    case 'text':
      return `<p style="font-family:sans-serif;font-size:${p.fontSize || '16px'};color:${p.color || '#374151'};margin:0 0 16px 0;line-height:1.6;">${p.text || ''}</p>`
    case 'button':
      return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="${p.align || 'center'}" style="padding:8px 0;"><a href="${p.url || '#'}" style="display:inline-block;background:${p.bgColor || '#2563eb'};color:${p.textColor || '#ffffff'};font-family:sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">${p.text || 'Click here'}</a></td></tr></table>`
    case 'image':
      return p.src
        ? `<img src="${p.src}" alt="${p.alt || ''}" width="${p.width || '100%'}" style="display:block;max-width:100%;border:0;" />`
        : `<div style="background:#f3f4f6;border:2px dashed #d1d5db;border-radius:4px;padding:32px;text-align:center;font-family:sans-serif;color:#9ca3af;font-size:14px;">Image placeholder</div>`
    case 'divider':
      return `<hr style="border:none;border-top:1px solid ${p.color || '#e5e7eb'};margin:24px 0;" />`
    case 'spacer':
      return `<div style="height:${p.height || '24px'};background:transparent;"></div>`
    default:
      return ''
  }
}

function BlockPropertyEditor({
  block,
  onChange,
}: {
  block: Block
  onChange: (props: Record<string, unknown>) => void
}) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock props={block.props} onChange={onChange} />
    case 'text':
      return <TextBlock props={block.props} onChange={onChange} />
    case 'button':
      return <ButtonBlock props={block.props} onChange={onChange} />
    case 'image':
      return <ImageBlock props={block.props} onChange={onChange} />
    case 'divider':
      return <DividerBlock props={block.props} onChange={onChange} />
    case 'spacer':
      return <SpacerBlock props={block.props} onChange={onChange} />
    default:
      return null
  }
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addBlock = useCallback(
    (meta: BlockTypeMeta) => {
      const newBlock: Block = {
        id: nanoid(8),
        type: meta.type,
        props: { ...meta.defaultProps },
      }
      onChange([...blocks, newBlock])
      setSelectedId(newBlock.id)
    },
    [blocks, onChange]
  )

  const removeBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [blocks, onChange, selectedId]
  )

  const updateBlockProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, props } : b)))
    },
    [blocks, onChange]
  )

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return
      const reordered = Array.from(blocks)
      const [removed] = reordered.splice(result.source.index, 1)
      reordered.splice(result.destination.index, 0, removed)
      onChange(reordered)
    },
    [blocks, onChange]
  )

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: block type picker */}
      <div className="w-48 shrink-0 border-r bg-white overflow-y-auto flex flex-col">
        <div className="px-3 py-3 border-b">
          <p className="text-sm font-semibold text-slate-700">Blocks</p>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {BLOCK_TYPES.map((meta) => (
            <button
              key={meta.type}
              onClick={() => addBlock(meta)}
              className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-slate-500">{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center panel: preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="px-4 py-3 border-b bg-white flex items-center justify-center">
          <p className="text-sm text-slate-500">Click a block to select it. Drag to reorder.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[600px] mx-auto bg-white shadow rounded-lg p-8 min-h-[400px]">
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-slate-400 text-sm">Add blocks from the left panel to start building your email.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="block-list">
                  {(droppableProvided) => (
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="flex flex-col gap-1"
                    >
                      {blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(draggableProvided, snapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              onClick={() => setSelectedId(block.id)}
                              className={[
                                'group relative rounded transition-all cursor-pointer',
                                selectedId === block.id
                                  ? 'ring-2 ring-blue-500 ring-offset-1'
                                  : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1',
                                snapshot.isDragging ? 'shadow-lg opacity-90' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {/* Drag handle */}
                              <div
                                {...draggableProvided.dragHandleProps}
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-400"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>

                              {/* Delete button */}
                              <button
                                className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded p-0.5 bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeBlock(block.id)
                                }}
                                title="Remove block"
                              >
                                <X className="h-3 w-3" />
                              </button>

                              {/* Block preview */}
                              <div
                                dangerouslySetInnerHTML={{ __html: renderBlockPreview(block) }}
                                className="pointer-events-none select-none"
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: properties */}
      <div className="w-72 shrink-0 border-l bg-white overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold text-slate-700">Properties</p>
        </div>
        <div className="p-4">
          {selectedBlock === null ? (
            <p className="text-sm text-slate-400">Select a block to edit its properties.</p>
          ) : (
            <BlockPropertyEditor
              key={selectedBlock.id}
              block={selectedBlock}
              onChange={(props) => updateBlockProps(selectedBlock.id, props)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
