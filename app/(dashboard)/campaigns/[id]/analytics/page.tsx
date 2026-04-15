'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface AnalyticsData {
  sent: number
  bounced: number
  failed: number
  opens: number
  clicks: number
  topLinks: { linkUrl: string; count: number }[]
  timeline: { hour: string; opens: number; clicks: number }[]
}

function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function truncateUrl(url: string, maxLength = 60): string {
  if (url.length <= maxLength) return url
  return url.slice(0, maxLength) + '...'
}

function formatHour(value: string): string {
  try {
    return format(parseISO(value), 'MMM d HH:mm')
  } catch {
    return value
  }
}

export default function CampaignAnalyticsPage() {
  const params = useParams()
  const id = params.id as string

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/internal/campaigns/${id}/analytics`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Failed to load analytics')
          return
        }
        const data = await res.json()
        setAnalytics(data)
      } catch {
        setError('Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [id])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/campaigns/${id}`}>&larr; Back to Campaign</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Campaign Analytics</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : analytics ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{analytics.sent.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatRate(analytics.opens, analytics.sent)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analytics.opens.toLocaleString()} unique opens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Click Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatRate(analytics.clicks, analytics.sent)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analytics.clicks.toLocaleString()} unique clicks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bounced
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{analytics.bounced.toLocaleString()}</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle>Opens and Clicks Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : analytics && analytics.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={analytics.timeline}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={formatHour}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(value) => formatHour(String(value))}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 13 }}
                />
                <Line
                  type="monotone"
                  dataKey="opens"
                  name="Opens"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No tracking data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top clicked links */}
      <Card>
        <CardHeader>
          <CardTitle>Top Clicked Links</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : analytics && analytics.topLinks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-24 text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topLinks.map((link, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      <a
                        href={link.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title={link.linkUrl}
                      >
                        {truncateUrl(link.linkUrl)}
                      </a>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {link.count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No click data yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
