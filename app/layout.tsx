import type { Metadata } from "next"
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const heading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
})

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "hedwig",
  description: "Self-hosted broadcast email tool",
  icons: {
    icon: [
      { url: "/assets/logo/favicon-sm.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/logo/favicon-md.png", sizes: "64x64", type: "image/png" },
      { url: "/assets/logo/favicon-lg.png", sizes: "128x128", type: "image/png" },
      { url: "/assets/logo/favicon-xl.png", sizes: "256x256", type: "image/png" },
    ],
    apple: "/assets/logo/favicon-xl.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${heading.variable} ${body.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
