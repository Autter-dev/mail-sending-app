"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"

interface Stats {
  totalLists: number
  totalContacts: number
  totalSent: number
  avgOpenRate: number
}

interface Campaign {
  id: string
  name: string
  status: string
  sentAt: string | null
  totalRecipients: number | null
  sent: number
  opens: number
  clicks: number
  listName: string | null
}

const STATUS_VARIANT: Record<string, string> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  failed: "destructive",
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [listsRes, campaignsRes] = await Promise.all([
          fetch("/api/internal/lists"),
          fetch("/api/internal/campaigns"),
        ])

        const listsData = await listsRes.json()
        const campaignsData = await campaignsRes.json()

        const totalLists = listsData.length
        const totalContacts = listsData.reduce(
          (sum: number, l: { total: number }) => sum + (l.total || 0),
          0
        )

        const sentCampaigns = campaignsData.filter(
          (c: Campaign) => c.status === "sent"
        )
        const totalSent = sentCampaigns.length

        let avgOpenRate = 0
        if (sentCampaigns.length > 0) {
          const rates = sentCampaigns
            .filter((c: Campaign) => c.sent > 0)
            .map((c: Campaign) => (c.opens / c.sent) * 100)
          avgOpenRate =
            rates.length > 0
              ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length
              : 0
        }

        setStats({ totalLists, totalContacts, totalSent, avgOpenRate })
        setCampaigns(campaignsData.slice(0, 5))
      } catch {
        // fail silently on dashboard
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Lists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalLists ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalContacts ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaigns Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalSent ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Open Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats?.avgOpenRate?.toFixed(1) ?? "0.0"}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/lists">
          <Button variant="outline">Create List</Button>
        </Link>
        <Link href="/campaigns">
          <Button>New Campaign</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No campaigns yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.listName || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (STATUS_VARIANT[c.status] as
                            | "default"
                            | "secondary"
                            | "outline"
                            | "destructive") || "secondary"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.sent ?? 0}</TableCell>
                    <TableCell>
                      {c.sent > 0
                        ? `${((c.opens / c.sent) * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {c.sentAt
                        ? format(new Date(c.sentAt), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
