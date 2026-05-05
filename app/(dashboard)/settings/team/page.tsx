"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { format, formatDistanceToNow } from "date-fns"

interface Member {
  id: string
  email: string
  name: string | null
  role: "admin" | "member"
  createdAt: string
  lastLoginAt: string | null
}

interface Invite {
  id: string
  email: string
  role: "admin" | "member"
  invitedBy: string
  expiresAt: string
  createdAt: string
}

type ExpiresInDays = 3 | 7 | 30

export default function TeamPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [inviteExpiry, setInviteExpiry] = useState<ExpiresInDays>(7)
  const [creating, setCreating] = useState(false)

  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)
  const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      const [m, i] = await Promise.all([
        fetch("/api/internal/team/members"),
        fetch("/api/internal/team/invites"),
      ])
      if (m.ok) setMembers(await m.json())
      if (i.ok) setInvites(await i.json())
    } catch {
      toast({ title: "Failed to load team", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const resetInviteForm = () => {
    setInviteEmail("")
    setInviteRole("member")
    setInviteExpiry(7)
    setCreatedLink(null)
  }

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/internal/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          expiresInDays: inviteExpiry,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to create invite", variant: "destructive" })
        return
      }
      setCreatedLink(data.inviteUrl)
      fetchAll()
    } catch {
      toast({ title: "Failed to create invite", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!removeMemberId) return
    try {
      const res = await fetch(`/api/internal/team/members/${removeMemberId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: "Member removed" })
        fetchAll()
      } else {
        toast({ title: data.error || "Failed to remove", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" })
    } finally {
      setRemoveMemberId(null)
    }
  }

  const handleRevokeInvite = async () => {
    if (!revokeInviteId) return
    try {
      const res = await fetch(`/api/internal/team/invites/${revokeInviteId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Invite revoked" })
        fetchAll()
      }
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" })
    } finally {
      setRevokeInviteId(null)
    }
  }

  const handleRoleChange = async (id: string, role: "admin" | "member") => {
    try {
      const res = await fetch(`/api/internal/team/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: "Role updated" })
        fetchAll()
      } else {
        toast({ title: data.error || "Failed to update role", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite members to share access. The admin defined in ADMIN_EMAIL stays
            synced from the environment on login.
          </p>
        </div>
        <Dialog
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open)
            if (!open) resetInviteForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>Invite member</Button>
          </DialogTrigger>
          <DialogContent>
            {createdLink ? (
              <>
                <DialogHeader>
                  <DialogTitle>Invite created</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Copy this one time link and share it with the new member. It will
                    not be shown again.
                  </p>
                  <div className="flex gap-2">
                    <Input value={createdLink} readOnly className="font-mono text-xs" />
                    <Button variant="outline" onClick={() => copyToClipboard(createdLink)}>
                      Copy
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setInviteOpen(false)
                      resetInviteForm()
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Invite member</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as "admin" | "member")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Admins can manage providers, API keys, suppressions, and the team.
                    </p>
                  </div>
                  <div>
                    <Label>Expires in</Label>
                    <Select
                      value={String(inviteExpiry)}
                      onValueChange={(v) => setInviteExpiry(Number(v) as ExpiresInDays)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateInvite}
                    disabled={creating || !inviteEmail.trim()}
                  >
                    {creating ? "Creating..." : "Create invite"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Members</h2>
        {members.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground">
            No members yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = session?.user?.email === m.email
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.email}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{m.name || "-"}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                          {m.role}
                        </Badge>
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            handleRoleChange(m.id, v as "admin" | "member")
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">member</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.lastLoginAt
                        ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>{format(new Date(m.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {!isSelf ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => setRemoveMemberId(m.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold font-heading">Pending invites</h2>
        {invites.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground">
            No pending invites.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => {
                const expired = new Date(inv.expiresAt).getTime() < Date.now()
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant={inv.role === "admin" ? "default" : "secondary"}>
                        {inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.invitedBy}
                    </TableCell>
                    <TableCell>
                      {expired ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive/80"
                        onClick={() => setRevokeInviteId(inv.id)}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog
        open={removeMemberId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They will lose access immediately. To restore access, invite them again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeInviteId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeInviteId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invite</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The link will stop working immediately. You can create a new invite later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeInviteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeInvite}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
