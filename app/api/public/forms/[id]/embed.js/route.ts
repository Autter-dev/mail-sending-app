import { NextResponse } from 'next/server'
import { buildEmbedScript } from '@/lib/forms/embed-template'

export async function GET() {
  const appUrl = process.env.APP_URL ?? ''
  const body = buildEmbedScript(appUrl)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
