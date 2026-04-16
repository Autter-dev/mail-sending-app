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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  draft: "secondary",
  scheduled: "warning",
  sending: "info",
  sent: "success",
  failed: "destructive",
}

const STAT_ICONS = [
  <svg key="lists" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  <svg key="contacts" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
  <svg key="sent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" /><polyline points="22,6 12,13 2,6" /></svg>,
  <svg key="rate" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>,
]

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const statCards = [
    { label: "Total Lists", value: stats?.totalLists ?? 0 },
    { label: "Total Contacts", value: stats?.totalContacts ?? 0 },
    { label: "Campaigns Sent", value: stats?.totalSent ?? 0 },
    { label: "Avg Open Rate", value: `${stats?.avgOpenRate?.toFixed(1) ?? "0.0"}%` },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold font-heading">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold font-heading mt-1">{stat.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {STAT_ICONS[i]}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
          <CardTitle className="text-lg">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Create one to get started.
              </p>
            </div>
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
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.listName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] || "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.sent ?? 0}</TableCell>
                    <TableCell>
                      {c.sent > 0
                        ? `${((c.opens / c.sent) * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
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
