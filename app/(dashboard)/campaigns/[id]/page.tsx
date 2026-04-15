"use client"
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface Campaign {
  id: string
  name: string
  subject: string
  fromName: string
  fromEmail: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number | null
  cancelRequested: boolean
  listId: string
  listName?: string
  sentCount?: number
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'secondary',
  scheduled: 'outline',
  sending: 'default',
  sent: 'default',
  failed: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: string }) {
  const variant = (STATUS_BADGE[status] ?? 'secondary') as
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [scheduleOption, setScheduleOption] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/campaigns/${campaignId}`)
      if (!res.ok) throw new Error('Failed to fetch campaign')
      const data = await res.json()
      setCampaign(data)
    } catch {
      toast({ title: 'Error', description: 'Could not load campaign.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [campaignId, toast])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  // Poll every 3 seconds while status is 'sending'
  useEffect(() => {
    if (campaign?.status !== 'sending') return
    const interval = setInterval(fetchCampaign, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, fetchCampaign])

  async function handleSend() {
    setSending(true)
    try {
      const body: { scheduledAt?: string } = {}
      if (scheduleOption === 'later' && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString()
      }
      const res = await fetch(`/api/internal/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error ?? 'Failed to send campaign.', variant: 'destructive' })
        return
      }
      setSendDialogOpen(false)
      toast({
        title: scheduleOption === 'later' ? 'Campaign scheduled' : 'Campaign sending',
        description:
          scheduleOption === 'later'
            ? `Scheduled to send to ${data.queued} recipients.`
            : `Sending to ${data.queued} recipients.`,
      })
      await fetchCampaign()
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch(`/api/internal/campaigns/${campaignId}/cancel`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.error ?? 'Failed to cancel campaign.', variant: 'destructive' })
        return
      }
      toast({ title: 'Cancelled', description: 'The campaign has been cancelled.' })
      await fetchCampaign()
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading campaign...</p>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/campaigns')}>
          Back to Campaigns
        </Button>
      </div>
    )
  }

  const progressPercent =
    campaign.totalRecipients && campaign.sentCount != null
      ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100)
      : 0

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-sm text-muted-foreground hover:underline">
            Campaigns
          </Link>
          <h1 className="text-2xl font-bold mt-1">{campaign.name}</h1>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">List</p>
            <p className="font-medium">{campaign.listName ?? campaign.listId}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Subject</p>
            <p className="font-medium">{campaign.subject || 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">From</p>
            <p className="font-medium">
              {campaign.fromName ? `${campaign.fromName} (${campaign.fromEmail})` : campaign.fromEmail || 'Not set'}
            </p>
          </div>
          {campaign.scheduledAt && (
            <div>
              <p className="text-muted-foreground">Scheduled</p>
              <p className="font-medium">{format(new Date(campaign.scheduledAt), 'PPpp')}</p>
            </div>
          )}
          {campaign.sentAt && (
            <div>
              <p className="text-muted-foreground">Sent at</p>
              <p className="font-medium">{format(new Date(campaign.sentAt), 'PPpp')}</p>
            </div>
          )}
          {campaign.totalRecipients != null && (
            <div>
              <p className="text-muted-foreground">Total recipients</p>
              <p className="font-medium">{campaign.totalRecipients.toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status-specific UI */}

      {/* DRAFT */}
      {campaign.status === 'draft' && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/editor/${campaign.id}`}>Configure in Editor</Link>
            </Button>
            <Button onClick={() => setSendDialogOpen(true)}>Send Campaign</Button>
          </CardContent>
        </Card>
      )}

      {/* SENDING */}
      {campaign.status === 'sending' && (
        <Card>
          <CardHeader>
            <CardTitle>Sending in progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.totalRecipients != null && campaign.sentCount != null ? (
              <>
                <Progress value={progressPercent} />
                <p className="text-sm text-muted-foreground">
                  {campaign.sentCount.toLocaleString()} of {campaign.totalRecipients.toLocaleString()} sent ({progressPercent}%)
                </p>
              </>
            ) : (
              <>
                <Progress value={undefined} className="animate-pulse" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </>
            )}
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Campaign'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SENT */}
      {campaign.status === 'sent' && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sent to {campaign.totalRecipients?.toLocaleString() ?? 'N/A'} recipients
              {campaign.sentAt ? ` on ${format(new Date(campaign.sentAt), 'PPpp')}` : ''}.
            </p>
            <Button asChild>
              <Link href={`/campaigns/${campaign.id}/analytics`}>View Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SCHEDULED */}
      {campaign.status === 'scheduled' && (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.scheduledAt && (
              <p className="text-sm text-muted-foreground">
                This campaign is scheduled to send on {format(new Date(campaign.scheduledAt), 'PPpp')}.
              </p>
            )}
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Scheduled Send'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FAILED */}
      {campaign.status === 'failed' && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This campaign encountered an error during sending.
            </p>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link href={`/editor/${campaign.id}`}>Open in Editor</Link>
              </Button>
              <Button onClick={() => setSendDialogOpen(true)}>Retry Send</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleOption"
                  value="now"
                  checked={scheduleOption === 'now'}
                  onChange={() => setScheduleOption('now')}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">Send now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleOption"
                  value="later"
                  checked={scheduleOption === 'later'}
                  onChange={() => setScheduleOption('later')}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">Schedule for later</span>
              </label>
            </div>

            {scheduleOption === 'later' && (
              <div className="space-y-1">
                <Label htmlFor="scheduledAt">Scheduled date and time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || (scheduleOption === 'later' && !scheduledAt)}
            >
              {sending
                ? 'Sending...'
                : scheduleOption === 'later'
                ? 'Schedule'
                : 'Send now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
