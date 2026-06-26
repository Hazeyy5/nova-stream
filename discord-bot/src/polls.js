import { randomUUID } from 'crypto'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js'
import { activePolls, deletePoll, getPoll } from './pollStore.js'

const OPTION_KEYS = ['option1', 'option2', 'option3', 'option4', 'option5']
const MAX_QUESTION = 256
const MAX_ANSWER = 80
const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

function uniqueOptions(raw) {
  const seen = new Set()
  const out = []
  for (const value of raw) {
    const text = value.trim().slice(0, MAX_ANSWER)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function parseOptions(interaction) {
  const question = interaction.options.getString('question', true).trim().slice(0, MAX_QUESTION)
  const rawOptions = OPTION_KEYS.map((key) => interaction.options.getString(key)).filter(Boolean)
  const options = uniqueOptions(rawOptions)
  if (options.length < 2) {
    throw new Error('Indiquez au moins **2 options** différentes (`option1` et `option2` minimum).')
  }
  const duration = interaction.options.getInteger('duree') ?? 24
  const multi = interaction.options.getBoolean('multi') ?? false
  return { question, options, duration, multi }
}

function totalVotes(poll) {
  if (poll.multi) {
    return poll.options.reduce((sum, o) => sum + o.voters.size, 0)
  }
  const voters = new Set()
  for (const opt of poll.options) {
    for (const id of opt.voters) voters.add(id)
  }
  return voters.size
}

function progressBar(pct) {
  const filled = Math.round(pct / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function renderEmbed(poll, { ended = false } = {}) {
  const total = totalVotes(poll)
  const lines = poll.options.map((o, i) => {
    const count = o.voters.size
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return `${EMOJI_NUMBERS[i] ?? '•'} **${o.label}**\n${progressBar(pct)} ${count} (${pct}%)`
  })

  let footer = ended
    ? 'Sondage terminé'
    : total === 0
      ? 'Cliquez sur un bouton pour voter'
      : `${total} vote${total !== 1 ? 's' : ''} · ${poll.multi ? 'plusieurs choix autorisés' : 'un seul choix par personne'}`

  if (!ended && poll.endsAt) {
    const hoursLeft = Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 3_600_000))
    footer += hoursLeft > 0 ? ` · fin dans ~${hoursLeft} h` : ''
  }

  return new EmbedBuilder()
    .setTitle(ended ? `📊 ${poll.question} — terminé` : `📊 ${poll.question}`)
    .setColor(ended ? 0x64748b : 0x9146ff)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: footer })
}

function buildButtonRows(pollId, poll, disabled = false) {
  const rows = []
  let current = new ActionRowBuilder()

  poll.options.forEach((opt, i) => {
    if (current.components.length >= 5) {
      rows.push(current)
      current = new ActionRowBuilder()
    }
    current.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll:${pollId}:${i}`)
        .setLabel(opt.label.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    )
  })

  if (current.components.length > 0) rows.push(current)
  return rows
}

async function updatePollMessage(message, poll, pollId, ended = false) {
  await message.edit({
    embeds: [renderEmbed(poll, { ended })],
    components: buildButtonRows(pollId, poll, ended)
  })
}

function schedulePollEnd(client, pollId, durationHours) {
  const ms = durationHours * 3_600_000
  setTimeout(async () => {
    const poll = getPoll(pollId)
    if (!poll || poll.ended) return
    poll.ended = true
    try {
      const channel = await client.channels.fetch(poll.channelId)
      if (!channel?.isTextBased()) return
      const message = await channel.messages.fetch(poll.messageId)
      await updatePollMessage(message, poll, pollId, true)
    } catch (err) {
      console.warn('[Nova Discord] Fin sondage:', err instanceof Error ? err.message : err)
    }
    deletePoll(pollId)
  }, ms).unref?.()
}

export async function handlePollCommand(interaction) {
  let parsed
  try {
    parsed = parseOptions(interaction)
  } catch (err) {
    await interaction.reply({
      content: err instanceof Error ? err.message : 'Sondage invalide.',
      ephemeral: true
    })
    return true
  }

  const { question, options, duration, multi } = parsed
  const pollId = randomUUID().slice(0, 12)

  const poll = {
    pollId,
    question,
    options: options.map((label) => ({ label, voters: new Set() })),
    multi,
    duration,
    endsAt: Date.now() + duration * 3_600_000,
    creatorId: interaction.user.id,
    channelId: null,
    messageId: null,
    ended: false
  }

  activePolls.set(pollId, poll)

  const embed = renderEmbed(poll)
  const components = buildButtonRows(pollId, poll)

  const message = await interaction.reply({
    content: `Sondage lancé par ${interaction.user}`,
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
    fetchReply: true
  })

  poll.messageId = message.id
  poll.channelId = message.channelId

  schedulePollEnd(interaction.client, pollId, duration)
  return true
}

export async function handlePollButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('poll:')) return false

  const parts = interaction.customId.split(':')
  const pollId = parts[1]
  const optionIndex = Number.parseInt(parts[2], 10)

  const poll = getPoll(pollId)
  if (!poll || poll.ended) {
    await interaction.reply({ content: 'Ce sondage est terminé ou introuvable.', ephemeral: true })
    return true
  }

  if (poll.endsAt && Date.now() > poll.endsAt) {
    poll.ended = true
    await interaction.reply({ content: 'Ce sondage est terminé.', ephemeral: true })
    return true
  }

  const option = poll.options[optionIndex]
  if (!option) {
    await interaction.reply({ content: 'Option invalide.', ephemeral: true })
    return true
  }

  const userId = interaction.user.id

  if (poll.multi) {
    if (option.voters.has(userId)) {
      option.voters.delete(userId)
      await updatePollMessage(interaction.message, poll, pollId)
      await interaction.reply({ content: `Vote retiré pour **${option.label}**.`, ephemeral: true })
      return true
    }
  } else {
    for (const opt of poll.options) {
      opt.voters.delete(userId)
    }
  }

  option.voters.add(userId)
  await updatePollMessage(interaction.message, poll, pollId)
  await interaction.reply({ content: `✅ Vote enregistré pour **${option.label}**.`, ephemeral: true })
  return true
}
