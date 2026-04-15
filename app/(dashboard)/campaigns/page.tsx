"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

interface CampaignRow {
  id: string
  name: string
  subject: string
  status: string
  listId: string
  listName?: string
  totalRecipients: number | null
  opens: number
  clicks: number
  sentAt: string | null
  createdAt: string
}

interface ListOption {
  id: string
  name: string
}

function statusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    scheduled: "outline",
    sending: "default",
    sent: "default",
    failed: "destructive",
  }
  const classNames: Record<string, string> = {
    sent: "bg-green-600 text-white hover:bg-green-700",
    sending: "bg-blue-600 text-white hover:bg-blue-700",
    scheduled: "border-yellow-500 text-yellow-700 bg-yellow-50",
  }
  return (
    <Badge variant={variants[status] || "secondary"} className={classNames[status] || ""}>
      {status}
    </Badge>
  )
}

function calcRate(numerator: number, total: number | null): string {
  if (!total || total === 0) return "-"
  return `${((numerator / total) * 100).toFixed(1)}%`
}

export default function CampaignsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [lists, setLists] = useState<ListOption[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newListId, setNewListId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [campaignsRes, listsRes] = await Promise.all([
          fetch("/api/internal/campaigns"),
          fetch("/api/internal/lists"),
        ])
        if (!campaignsRes.ok || !listsRes.ok) {
          toast({ title: "Failed to load data", variant: "destructive" })
          return
        }
        const campaignsData = await campaignsRes.json()
        const listsData = await listsRes.json()
        setCampaigns(campaignsData)
        setLists(listsData)
      } catch {
        toast({ title: "An error occurred while loading data", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  function openDialog() {
    setNewName("")
    setNewListId("")
    setDialogOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" })
      return
    }
    if (!newListId) {
      toast({ title: "Please select a list", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/internal/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), listId: newListId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: err.error || "Failed to create campaign", variant: "destructive" })
        return
      }
      const created = await res.json()
      setDialogOpen(false)
      router.push(`/editor/${created.id}`)
    } catch {
      toast({ title: "An error occurred while creating the campaign", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button onClick={openDialog}>New Campaign</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first campaign to get started.</p>
          <Button className="mt-4" onClick={openDialog}>
            New Campaign
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium hover:underline text-foreground"
                    >
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.listName || "-"}
                  </TableCell>
                  <TableCell>{statusBadge(campaign.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.totalRecipients ?? "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calcRate(campaign.opens, campaign.totalRecipients)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calcRate(campaign.clicks, campaign.totalRecipients)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {campaign.sentAt
                      ? format(new Date(campaign.sentAt), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/editor/${campaign.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g. April Newsletter"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-list">List</Label>
              <Select value={newListId} onValueChange={setNewListId}>
                <SelectTrigger id="campaign-list">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No lists available
                    </SelectItem>
                  ) : (
                    lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
