import type { DonationSettings } from '../types'

export const DONATION_ALERT_DEFAULTS = {
  alertTitle: 'Don',
  alertDefaultMessage: 'Merci pour votre soutien !',
  alertMessageTemplate: '{amount} — {message}'
} as const

export interface DonationAlertInput {
  donorName: string
  message: string
  amount: number
  currency: string
}

export function formatDonationAlertMessage(
  donation: DonationAlertInput,
  settings?: Partial<DonationSettings> | null
): { title: string; message: string; amountLabel: string } {
  const symbol = donation.currency === 'USD' ? '$' : '€'
  const amountLabel = `${donation.amount}${symbol}`
  const title = settings?.alertTitle?.trim() || DONATION_ALERT_DEFAULTS.alertTitle
  const defaultMessage =
    settings?.alertDefaultMessage?.trim() ||
    settings?.thankYouMessage?.trim() ||
    DONATION_ALERT_DEFAULTS.alertDefaultMessage
  const template = settings?.alertMessageTemplate?.trim() || DONATION_ALERT_DEFAULTS.alertMessageTemplate
  const messageText = donation.message?.trim() || defaultMessage
  const donorName = donation.donorName?.trim() || 'Anonyme'
  const message = template
    .replace(/\{name\}/g, donorName)
    .replace(/\{amount\}/g, amountLabel)
    .replace(/\{message\}/g, messageText)

  return { title, message, amountLabel }
}
