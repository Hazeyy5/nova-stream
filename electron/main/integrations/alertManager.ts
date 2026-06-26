import { randomUUID } from 'crypto'
import type { StreamAlert } from '../../../src/types'
import { formatDonationAlertMessage } from '../../../src/lib/donationAlertText'

export class AlertManager {
  private onAlert?: (alert: StreamAlert) => void
  private getDonationSettings?: () => import('../../../src/types').DonationSettings | undefined

  setOnAlert(callback: (alert: StreamAlert) => void): void {
    this.onAlert = callback
  }

  setDonationSettingsProvider(getter: () => import('../../../src/types').DonationSettings | undefined): void {
    this.getDonationSettings = getter
  }

  triggerTest(type: StreamAlert['type'] = 'follow'): void {
    if (type === 'donation') {
      const { title, message, amountLabel } = formatDonationAlertMessage(
        { donorName: 'GenerousFan', message: '', amount: 5, currency: 'EUR' },
        this.getDonationSettings?.()
      )
      this.emit({
        id: randomUUID(),
        type: 'donation',
        username: 'GenerousFan',
        title,
        message,
        amount: amountLabel
      })
      return
    }

    const alerts: Record<Exclude<StreamAlert['type'], 'donation'>, Partial<StreamAlert>> = {
      follow: { username: 'NovaViewer', message: 'vient de suivre la chaîne !' },
      sub: { username: 'SuperSub', message: 'vient de s\'abonner !', amount: 'Tier 1' },
      raid: { username: 'RaidLeader', message: 'raid avec 42 viewers !', amount: '42' },
      bits: { username: 'CheerFan', message: 'GG le stream !', amount: '500 bits' }
    }
    this.emit({ id: randomUUID(), type, ...alerts[type] } as StreamAlert)
  }

  private emit(alert: StreamAlert): void {
    this.onAlert?.(alert)
  }
}
