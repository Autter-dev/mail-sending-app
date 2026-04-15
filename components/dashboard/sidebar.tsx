'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface NavItem {
  label: string
  href: string
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Lists', href: '/lists' },
  { label: 'Campaigns', href: '/campaigns' },
]

const settingsNavItems: NavItem[] = [
  { label: 'Providers', href: '/settings/providers' },
  { label: 'API Keys', href: '/settings/api-keys' },
]

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {item.label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900">
      <div className="flex items-center px-6 py-5">
        <span className="text-lg font-bold text-white">Mailpost</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="pt-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Settings
          </p>
          {settingsNavItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
