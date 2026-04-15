"use client"
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ListInfo {
  id: string
  name: string
  description?: string
  createdAt: string
  counts: {
    active: number
    bounced: number
    unsubscribed: number
    total: number
  }
}

interface Contact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  status: string
  createdAt: string
}

interface ContactsMeta {
  page: number
  limit: number
  total: number
}

type TabStatus = 'active' | 'bounced' | 'unsubscribed'

export default function ListDetailPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const listId = params.id

  const [listInfo, setListInfo] = useState<ListInfo | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabStatus>('active')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [meta, setMeta] = useState<ContactsMeta>({ page: 1, limit: 50, total: 0 })
  const [contactsLoading, setContactsLoading] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [exporting, setExporting] = useState(false)

  // Fetch list info
  useEffect(() => {
    async function fetchList() {
      setListLoading(true)
      setListError(null)
      try {
        const res = await fetch(`/api/internal/lists/${listId}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setListError(body.error || 'Failed to load list.')
          return
        }
        const data = await res.json()
        setListInfo(data)
      } catch {
        setListError('Failed to load list.')
      } finally {
        setListLoading(false)
      }
    }
    fetchList()
  }, [listId])

  // Fetch contacts whenever tab, page, or search changes
  const fetchContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: String(page),
        limit: '50',
      })
      if (search) {
        params.set('search', search)
      }
      const res = await fetch(`/api/internal/lists/${listId}/contacts?${params.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      setContacts(json.data || [])
      setMeta(json.meta || { page: 1, limit: 50, total: 0 })
    } catch {
      // silently fail, table stays empty
    } finally {
      setContactsLoading(false)
    }
  }, [listId, activeTab, page, search])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  function handleTabChange(value: string) {
    setActiveTab(value as TabStatus)
    setPage(1)
    setSearchInput('')
    setSearch('')
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setSearch(searchInput.trim())
      setPage(1)
    }
  }

  function handleSearchClear() {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/internal/lists/${listId}/export`)
      if (!res.ok) {
        alert('Export failed.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts-${listId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit))

  if (listLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading list...</div>
    )
  }

  if (listError) {
    return (
      <div className="p-8">
        <p className="text-destructive text-sm">{listError}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/lists')}>
          Back to Lists
        </Button>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/lists" className="hover:underline">Lists</Link>
            <span>/</span>
            <span>{listInfo?.name}</span>
          </div>
          <h1 className="text-2xl font-semibold">{listInfo?.name}</h1>
          {listInfo?.description && (
            <p className="text-sm text-muted-foreground mt-1">{listInfo.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{listInfo?.counts.total ?? 0} total</Badge>
            <Badge variant="default">{listInfo?.counts.active ?? 0} active</Badge>
            {(listInfo?.counts.bounced ?? 0) > 0 && (
              <Badge variant="destructive">{listInfo?.counts.bounced} bounced</Badge>
            )}
            {(listInfo?.counts.unsubscribed ?? 0) > 0 && (
              <Badge variant="outline">{listInfo?.counts.unsubscribed} unsubscribed</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button asChild>
            <Link href={`/lists/${listId}/upload`}>Upload Contacts</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">
              {listInfo?.counts.active ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="bounced">
            Bounced
            <Badge variant="secondary" className="ml-2">
              {listInfo?.counts.bounced ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unsubscribed">
            Unsubscribed
            <Badge variant="secondary" className="ml-2">
              {listInfo?.counts.unsubscribed ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(['active', 'bounced', 'unsubscribed'] as TabStatus[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {/* Search bar */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by email, press Enter to search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="max-w-sm"
              />
              {search && (
                <Button variant="ghost" size="sm" onClick={handleSearchClear}>
                  Clear
                </Button>
              )}
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        Loading contacts...
                      </TableCell>
                    </TableRow>
                  ) : contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        {search
                          ? 'No contacts match your search.'
                          : `No ${tab} contacts in this list.`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.email}</TableCell>
                        <TableCell>{contact.firstName || '-'}</TableCell>
                        <TableCell>{contact.lastName || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {meta.total === 0
                  ? 'No contacts'
                  : `${meta.total} contact${meta.total !== 1 ? 's' : ''} total`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || contactsLoading}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || contactsLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
