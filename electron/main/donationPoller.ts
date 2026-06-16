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
  private since = 0
  private polling = false

  constructor(private onDonation: (donation: PendingDonation) => void) {}

  start(getSettings: () => DonationSettings | null | undefined): void {
    this.stop()
    this.since = Date.now() - 5000
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
    if (!settings?.enabled || !settings.donationKey) return

    const twitch = await ensureFreshTwitchToken()
    if (!twitch) return

    this.polling = true
    try {
      const url = new URL(`${apiUrl.replace(/\/$/, '')}/v1/poll`)
      url.searchParams.set('streamerId', twitch.userId)
      url.searchParams.set('key', settings.donationKey)
      url.searchParams.set('since', String(this.since))

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return

      const json = (await res.json()) as { success?: boolean; donations?: PendingDonation[] }
      if (!json.success || !Array.isArray(json.donations)) return

      for (const donation of json.donations) {
        this.onDonation(donation)
        this.since = Math.max(this.since, donation.createdAt)
      }
    } catch {
      /* réseau ou API indisponible */
    } finally {
      this.polling = false
    }
  }
}
