import { randomUUID } from 'crypto'
import type { StreamAlert } from '../../../src/types'

export class AlertManager {
  private onAlert?: (alert: StreamAlert) => void

  setOnAlert(callback: (alert: StreamAlert) => void): void {
    this.onAlert = callback
  }

  triggerTest(type: StreamAlert['type'] = 'follow'): void {
    const alerts: Record<StreamAlert['type'], Partial<StreamAlert>> = {
      follow: { username: 'NovaViewer', message: 'vient de suivre la chaîne !' },
      sub: { username: 'SuperSub', message: 'vient de s\'abonner !', amount: 'Tier 1' },
      donation: { username: 'GenerousFan', message: 'Merci pour le stream !', amount: '5€' },
      raid: { username: 'RaidLeader', message: 'raid avec 42 viewers !', amount: '42' }
    }
    this.emit({ id: randomUUID(), type, ...alerts[type] } as StreamAlert)
  }

  private emit(alert: StreamAlert): void {
    this.onAlert?.(alert)
  }
}
