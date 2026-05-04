'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

interface FormRow {
  id: string
  name: string
  listId: string
  listName: string | null
  doubleOptIn: boolean
  createdAt: string
}

interface ListOption {
  id: string
  name: string
}

export default function FormsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<ListOption[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [listId, setListId] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function refresh() {
    try {
      const [formsRes, listsRes] = await Promise.all([
        fetch('/api/internal/forms'),
        fetch('/api/internal/lists'),
      ])
      if (!formsRes.ok || !listsRes.ok) throw new Error()
      setRows(await formsRes.json())
      setLists(await listsRes.json())
    } catch {
      toast({ title: 'Error', description: 'Could not load forms.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !listId) return
    setCreating(true)
    try {
      const res = await fetch('/api/internal/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          listId,
          fromName: '',
          fromEmail: '',
          fields: [
            { id: crypto.randomUUID(), key: 'email', label: 'Email', type: 'email', required: true },
          ],
          doubleOptIn: false,
          confirmationSubject: '',
          confirmationTemplateJson: [],
          successMessage: 'Thanks for subscribing.',
          redirectUrl: null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Create failed')
      }
      const created = await res.json()
      setDialogOpen(false)
      setName('')
      setListId('')
      router.push(`/forms/${created.id}`)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not create form.',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this form? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/internal/forms/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Form deleted' })
      refresh()
    } catch {
      toast({ title: 'Error', description: 'Could not delete form.', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Embeddable signup forms that flow into your lists.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={lists.length === 0}>New Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a form</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Form name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="list">List</Label>
                <select
                  id="list"
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  required
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a list...</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Create a list before adding a form.{' '}
          <Link href="/lists" className="underline">
            Go to Lists
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        lists.length > 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No forms yet. Create one to get started.
          </div>
        ) : null
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Double opt-in</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={`/forms/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.listName ?? 'Unknown'}</TableCell>
                  <TableCell>
                    {row.doubleOptIn ? (
                      <Badge variant="secondary">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
