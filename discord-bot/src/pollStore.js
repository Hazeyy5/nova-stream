/** Sondages actifs en mémoire (messageId → état). */
export const activePolls = new Map()

export function getPollByMessageId(messageId) {
  for (const poll of activePolls.values()) {
    if (poll.messageId === messageId) return poll
  }
  return null
}

export function getPoll(pollId) {
  return activePolls.get(pollId) ?? null
}

export function deletePoll(pollId) {
  activePolls.delete(pollId)
}
