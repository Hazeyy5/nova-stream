import { getDonationsApiUrl } from './platformConfig'
import { ensureFreshTwitchToken } from './integrations/twitchTokenRefresh'
import type { DonationSettings } from '../../src/types'

export interface PendingDonation {
  id: string
  streamerId: string
  donorName: string
  message: string
  amount: number
  currency: string
  createdAt: number
}

export class DonationPoller {
  private timer: ReturnType<typeof setInterval> | null = null
  private seenIds = new Set<string>()
  private polling = false

  constructor(private onDonation: (donation: PendingDonation) => void) {}

  start(getSettings: () => DonationSettings | null | undefined): void {
    this.stop()
    void this.tick(getSettings)
    this.timer = setInterval(() => {
      void this.tick(getSettings)
    }, 2500)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.polling = false
  }

  private async tick(getSettings: () => DonationSettings | null | undefined): Promise<void> {
    if (this.polling) return
    const apiUrl = getDonationsApiUrl()
    if (!apiUrl) return

    const settings = getSettings()
    if (!settings?.enabled || !settings.donationKey) {
      return
    }

    const twitch = await ensureFreshTwitchToken()
    if (!twitch) return

    this.polling = true
    try {
      const url = new URL(`${apiUrl.replace(/\/$/, '')}/v1/poll`)
      url.searchParams.set('streamerId', twitch.userId)
      url.searchParams.set('key', settings.donationKey)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
      if (!res.ok) {
        console.warn('[donations] poll HTTP', res.status)
        return
      }

      const json = (await res.json()) as { success?: boolean; donations?: PendingDonation[]; message?: string }
      if (!json.success) {
        console.warn('[donations] poll refusé:', json.message ?? 'inconnu')
        return
      }
      if (!Array.isArray(json.donations) || json.donations.length === 0) return

      for (const donation of json.donations) {
        if (this.seenIds.has(donation.id)) continue
        this.seenIds.add(donation.id)
        console.log('[donations] alerte don reçue:', donation.donorName, donation.amount)
        this.onDonation(donation)
      }
    } catch (err) {
      console.warn('[donations] poll erreur:', err instanceof Error ? err.message : err)
    } finally {
      this.polling = false
    }
  }
}
