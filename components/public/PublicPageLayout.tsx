import Image from 'next/image'

interface PublicPageLayoutProps {
  appName: string
  children: React.ReactNode
}

export function PublicPageLayout({ appName, children }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8 text-center">
          <Image
            src="/assets/logo/primary-logo.png"
            alt={appName}
            width={720}
            height={345}
            priority
            unoptimized
            className="mx-auto mb-6 h-16 w-auto"
          />
          {children}
        </div>
      </div>
    </div>
  )
}
