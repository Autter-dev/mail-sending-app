import type { UnsubscribePageContent } from '@/lib/db/schema'
import { getAppSettings } from './index'
import { mergeUnsubscribePageContent } from './unsubscribe-page'

export async function getUnsubscribePageContent(): Promise<UnsubscribePageContent> {
  const settings = await getAppSettings()
  return mergeUnsubscribePageContent(settings.unsubscribePage)
}
