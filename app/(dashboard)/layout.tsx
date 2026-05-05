import { Sidebar } from '@/components/dashboard/sidebar'
import { SessionProviders } from '@/components/session-providers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProviders>
      <div className="flex min-h-screen bg-background">
        <div className="fixed inset-y-0 left-0 z-10">
          <Sidebar />
        </div>
        <main className="ml-64 flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </SessionProviders>
  )
}
