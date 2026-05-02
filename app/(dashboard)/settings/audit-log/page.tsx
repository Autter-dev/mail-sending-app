"use client"

import { Fragment, useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"

interface AuditLog {
  id: string
  actorType: "user" | "api_key" | "system"
  actorId: string | null
  actorLabel: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface Meta {
  page: number
  limit: number
  total: number
}

const ACTOR_TYPES = ["", "user", "api_key", "system"] as const
const RESOURCE_TYPES = ["", "list", "contact", "campaign", "provider", "api_key"] as const

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 50, total: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [actorType, setActorType] = useState<string>("")
  const [resourceType, setResourceType] = useState<string>("")
  const [actionFilter, setActionFilter] = useState<string>("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function fetchLogs() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: "50" })
        if (actorType) params.set("actorType", actorType)
        if (resourceType) params.set("resourceType", resourceType)
        if (actionFilter) params.set("action", actionFilter)
        const res = await fetch(`/api/internal/audit-logs?${params.toString()}`)
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (!cancelled) {
          setLogs(json.data || [])
          setMeta(json.meta || { page: 1, limit: 50, total: 0 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchLogs()
    return () => { cancelled = true }
  }, [page, actorType, resourceType, actionFilter])

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Append-only record of every state-changing action.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="filter-actor" className="text-xs">Actor type</Label>
          <select
            id="filter-actor"
            value={actorType}
            onChange={(e) => { setActorType(e.target.value); setPage(1) }}
            className="border rounded-md px-3 py-2 text-sm bg-background h-9"
          >
            {ACTOR_TYPES.map((t) => (
              <option key={t} value={t}>{t || "All"}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-resource" className="text-xs">Resource type</Label>
          <select
            id="filter-resource"
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(1) }}
            className="border rounded-md px-3 py-2 text-sm bg-background h-9"
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{t || "All"}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-action" className="text-xs">Action contains</Label>
          <Input
            id="filter-action"
            placeholder="e.g. campaign.send"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setPage(1)}
            className="w-56 h-9"
          />
        </div>
        {(actorType || resourceType || actionFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActorType("")
              setResourceType("")
              setActionFilter("")
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : logs.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-muted-foreground">
          No audit log entries match the current filters.
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.actorType === "user" ? "default" : log.actorType === "api_key" ? "secondary" : "outline"}>
                          {log.actorType}
                        </Badge>
                        <span className="text-sm">{log.actorLabel ?? "system"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.resourceType
                        ? `${log.resourceType}${log.resourceId ? ` / ${log.resourceId.slice(0, 8)}` : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        {expandedId === log.id ? "Hide" : "Details"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/40">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify({
                          actorId: log.actorId,
                          resourceId: log.resourceId,
                          ipAddress: log.ipAddress,
                          userAgent: log.userAgent,
                          metadata: log.metadata,
                        }, null, 2)}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {meta.total === 0 ? "No entries" : `${meta.total} entr${meta.total === 1 ? "y" : "ies"} total`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-muted-foreground px-2">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
