import type { CheckEmailInput, CheckEmailResult } from './types'

function getCheckerBaseUrl(): string {
  const base = process.env.EMAIL_CHECKER_BASE_URL?.trim()
  if (!base) {
    throw new Error('EMAIL_CHECKER_BASE_URL is not configured')
  }
  return base.replace(/\/$/, '')
}

export async function checkEmail(rawInput: CheckEmailInput = { to_email: '' }): Promise<CheckEmailResult> {
  const baseUrl = getCheckerBaseUrl()
  const url = `${baseUrl}/v1/check_email`

  const timeoutMsRaw = parseInt(process.env.EMAIL_CHECKER_TIMEOUT_MS || '30000', 10)
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 30000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const apiSecret = process.env.EMAIL_CHECKER_API_SECRET?.trim()
  if (apiSecret) {
    headers['x-api-secret'] = apiSecret
  }

  const payload = {
    ...rawInput,
    haveibeenpwned_api_key:
      rawInput.haveibeenpwned_api_key ?? process.env.HIBP_API_KEY ?? undefined,
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const msg =
        typeof body?.error === 'string'
          ? body.error
          : `Checker API request failed with status ${response.status}`
      throw new Error(msg)
    }

    return (await response.json()) as CheckEmailResult
  } finally {
    clearTimeout(timer)
  }
}
