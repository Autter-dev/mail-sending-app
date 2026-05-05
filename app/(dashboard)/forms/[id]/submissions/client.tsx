'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { FormField } from '@/lib/db/schema'

interface Submission {
  id: string
  email: string
  payload: Record<string, string>
  outcome: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const OUTCOMES = ['', 'created', 'duplicate', 'pending', 'suppressed'] as const

const outcomeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  created: 'default',
  pending: 'secondary',
  duplicate: 'outline',
  suppressed: 'destructive',
}

export function SubmissionsClient({
  formId,
  formName,
  fields,
}: {
  formId: string
  formName: string
  fields: FormField[]
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [outcome, setOutcome] = useState<string>('')
  const limit = 50

  const nonEmailFields = fields.filter((f) => f.type !== 'email')

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (outcome) params.set('outcome', outcome)
    fetch(`/api/internal/forms/${formId}/submissions?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((json) => {
        setRows(json.data)
        setTotal(json.meta.total)
      })
      .catch(() => toast({ title: 'Error', description: 'Could not load submissions.', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [formId, page, outcome, toast])

  function exportCsv() {
    const headers = ['email', 'outcome', 'created_at', 'ip', ...nonEmailFields.map((f) => f.key)]
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.email,
          r.outcome,
          r.createdAt,
          r.ipAddress ?? '',
          ...nonEmailFields.map((f) => r.payload?.[f.key] ?? ''),
        ]
          .map(escape)
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formName}-submissions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/forms" className="text-sm text-muted-foreground hover:underline">
            ← Forms
          </Link>
          <h1 className="text-2xl font-semibold font-heading mt-1">{formName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} submission{total === 1 ? '' : 's'} total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/forms/${formId}`}>
            <Button variant="outline" size="sm">
              Edit form
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {OUTCOMES.map((o) => (
          <button
            key={o || 'all'}
            onClick={() => {
              setOutcome(o)
              setPage(1)
            }}
            className={`text-sm px-3 py-1 rounded-md border ${
              outcome === o ? 'bg-foreground text-background' : 'bg-background hover:bg-accent'
            }`}
          >
            {o || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No submissions yet.
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  {nonEmailFields.map((f) => (
                    <TableHead key={f.id}>{f.label}</TableHead>
                  ))}
                  <TableHead>Outcome</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.email}</TableCell>
                    {nonEmailFields.map((f) => (
                      <TableCell key={f.id} className="text-muted-foreground">
                        {row.payload?.[f.key] ?? ''}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={outcomeVariant[row.outcome] ?? 'outline'}>{row.outcome}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(row.createdAt), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
