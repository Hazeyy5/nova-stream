/** Tickets actifs : channelId → métadonnées */
export const activeTickets = new Map()

export function getTicketByChannel(channelId) {
  return activeTickets.get(channelId) ?? null
}

export function registerTicket(channelId, data) {
  activeTickets.set(channelId, data)
}

export function unregisterTicket(channelId) {
  activeTickets.delete(channelId)
}
