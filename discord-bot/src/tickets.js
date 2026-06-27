import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  OverwriteType,
  PermissionFlagsBits
} from 'discord.js'
import { SETUP_MARKER } from './config.js'
import { activeTickets, getTicketByChannel, registerTicket, unregisterTicket } from './ticketStore.js'

export const TICKET_CATEGORY_NAME = '🎫 TICKETS'
export const TICKET_PANEL_CHANNEL = 'ouvrir-ticket'
export const TICKET_LOGS_CHANNEL = 'logs-tickets'

export const TICKET_TYPES = {
  app: { label: 'Application', emoji: '🖥️', description: 'Aide avec l\'app desktop Nova Stream' },
  bug: { label: 'Bug', emoji: '🐛', description: 'Signaler un dysfonctionnement' },
  widgets: { label: 'Widgets & Dons', emoji: '💰', description: 'Alertes, PayPal, Giphy, overlays' },
  other: { label: 'Autre', emoji: '💬', description: 'Autre demande ou question' }
}

const STAFF_ROLE_NAMES = ['Modérateur', 'Nova Admin']

function findStaffRoles(guild) {
  return STAFF_ROLE_NAMES.map((name) => guild.roles.cache.find((r) => r.name === name)).filter(Boolean)
}

function isStaff(member) {
  if (!member) return false
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true
  return STAFF_ROLE_NAMES.some((name) => member.roles.cache.some((r) => r.name === name))
}

export function findTicketCategory(guild) {
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === TICKET_CATEGORY_NAME
  ) ?? null
}

export async function findExistingTicketChannel(guild, userId) {
  const category = findTicketCategory(guild)
  if (!category) return null

  for (const channel of category.children.cache.values()) {
    if (!channel.isTextBased()) continue
    const ow = channel.permissionOverwrites.cache.get(userId)
    if (ow?.allow.has(PermissionFlagsBits.ViewChannel)) return channel
  }
  return null
}

async function ensureTicketCategory(guild) {
  await guild.channels.fetch().catch(() => {})
  await guild.roles.fetch().catch(() => {})

  let category = findTicketCategory(guild)
  if (category) return category

  const staffRoles = findStaffRoles(guild)
  const everyone = guild.roles.everyone
  const overwrites = [
    {
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ],
      type: OverwriteType.Role
    }))
  ]

  category = await guild.channels.create({
    name: TICKET_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: SETUP_MARKER
  })
  return category
}

function ticketChannelName(user, ticketNum) {
  const slug = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user'
  return `ticket-${String(ticketNum).padStart(3, '0')}-${slug}`
}

function nextTicketNumber(guild, category) {
  const nums = category.children.cache
    .filter((c) => c.name.startsWith('ticket-'))
    .map((c) => {
      const m = c.name.match(/^ticket-(\d+)-/)
      return m ? Number.parseInt(m[1], 10) : 0
    })
  return (nums.length ? Math.max(...nums) : 0) + 1
}

function buildTicketWelcomeEmbed(ticket, user) {
  const type = TICKET_TYPES[ticket.type] ?? TICKET_TYPES.other
  return new EmbedBuilder()
    .setTitle(`${type.emoji} Ticket #${String(ticket.number).padStart(3, '0')} — ${type.label}`)
    .setColor(0x9146ff)
    .setDescription([
      `Bonjour ${user}, merci d'avoir contacté le support **Nova Stream**.`,
      '',
      'Un membre de l\'équipe vous répondra dès que possible.',
      '',
      '**Pour accélérer le traitement :**',
      '• Version de l\'app (ex. v0.9.0)',
      '• Étapes pour reproduire le problème',
      '• Captures d\'écran si utile',
      '',
      'Utilisez le bouton **Fermer** ci-dessous quand votre demande est résolue.'
    ].join('\n'))
    .setFooter({ text: `Ouvert par ${user.tag}` })
    .setTimestamp(ticket.createdAt)
}

function buildTicketControlRow(channelId, claimedBy = null) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close:${channelId}`)
      .setLabel('Fermer le ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  )
  if (!claimedBy) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim:${channelId}`)
        .setLabel('Prendre en charge')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✋')
    )
  }
  return row
}

export function buildTicketPanelEmbed() {
  const lines = Object.entries(TICKET_TYPES).map(([, t]) => `${t.emoji} **${t.label}** — ${t.description}`)
  return new EmbedBuilder()
    .setTitle('🎫 Support Nova Stream')
    .setColor(0x5865f2)
    .setDescription([
      'Besoin d\'aide ? Ouvrez un **ticket privé** — seuls vous et l\'équipe pourrez voir la conversation.',
      '',
      '**Choisissez une catégorie :**',
      ...lines,
      '',
      '*Un seul ticket ouvert à la fois par personne.*'
    ].join('\n'))
}

export function buildTicketPanelComponents() {
  const entries = Object.entries(TICKET_TYPES)
  const row1 = new ActionRowBuilder()
  const row2 = new ActionRowBuilder()

  entries.forEach(([key, type], i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`ticket_open:${key}`)
      .setLabel(type.label)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(type.emoji)
    if (i < 2) row1.addComponents(btn)
    else row2.addComponents(btn)
  })

  return [row1, row2]
}

export async function postTicketPanel(channel) {
  const recent = await channel.messages.fetch({ limit: 8 }).catch(() => null)
  if (recent?.some((m) => m.author.id === channel.client.user.id && m.embeds[0]?.title?.includes('Support Nova Stream'))) {
    return false
  }

  await channel.send({
    embeds: [buildTicketPanelEmbed()],
    components: buildTicketPanelComponents()
  })
  return true
}

export async function createTicket(interaction, typeKey) {
  const type = TICKET_TYPES[typeKey]
  if (!type) {
    await interaction.reply({ content: 'Catégorie de ticket invalide.', ephemeral: true })
    return true
  }

  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild
  const user = interaction.user

  const existingChannel = await findExistingTicketChannel(guild, user.id)
  if (existingChannel) {
    await interaction.editReply({
      content: `Tu as déjà un ticket ouvert : ${existingChannel}`
    })
    return true
  }

  const category = await ensureTicketCategory(guild)
  const ticketNum = nextTicketNumber(guild, category)
  const staffRoles = findStaffRoles(guild)

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ],
      type: OverwriteType.Member
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ],
      type: OverwriteType.Role
    }))
  ]

  const channel = await guild.channels.create({
    name: ticketChannelName(user, ticketNum),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket ${type.label} — ${user.tag} (${user.id})`,
    permissionOverwrites: overwrites,
    reason: `Ticket Nova Stream — ${type.label}`
  })

  const ticket = {
    channelId: channel.id,
    ownerId: user.id,
    type: typeKey,
    number: ticketNum,
    createdAt: Date.now(),
    claimedBy: null
  }
  registerTicket(channel.id, ticket)

  await channel.send({
    content: `${user}${staffRoles.length ? ' ' + staffRoles.map((r) => `<@&${r.id}>`).join(' ') : ''}`,
    embeds: [buildTicketWelcomeEmbed(ticket, user)],
    components: [buildTicketControlRow(channel.id)],
    allowedMentions: { users: [user.id], roles: staffRoles.map((r) => r.id) }
  })

  await interaction.editReply({
    content: `✅ Ticket créé : ${channel} — décrivez votre problème dans ce salon.`
  })
  return true
}

async function findLogsChannel(guild) {
  return guild.channels.cache.find(
    (c) => c.isTextBased() && c.name === TICKET_LOGS_CHANNEL
  ) ?? null
}

async function closeTicket(channel, closedBy, reason = 'Résolu') {
  const ticket = getTicketByChannel(channel.id)
  const ownerId = ticket?.ownerId
  let ownerTag = ownerId ? `<@${ownerId}>` : 'Inconnu'

  if (ownerId) {
    try {
      const member = await channel.guild.members.fetch(ownerId)
      ownerTag = member.user.tag
    } catch { /* ignore */ }
  }

  const type = TICKET_TYPES[ticket?.type ?? 'other']
  const logEmbed = new EmbedBuilder()
    .setTitle(`🔒 Ticket #${String(ticket?.number ?? '?').padStart(3, '0')} fermé`)
    .setColor(0x64748b)
    .addFields(
      { name: 'Catégorie', value: `${type.emoji} ${type.label}`, inline: true },
      { name: 'Auteur', value: ownerTag, inline: true },
      { name: 'Fermé par', value: closedBy.tag, inline: true },
      { name: 'Salon', value: `#${channel.name}`, inline: true },
      { name: 'Raison', value: reason.slice(0, 1024) }
    )
    .setTimestamp()

  const logs = await findLogsChannel(channel.guild)
  if (logs?.isTextBased()) {
    await logs.send({ embeds: [logEmbed] }).catch(() => {})
  }

  unregisterTicket(channel.id)

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setDescription(`🔒 Ticket fermé par **${closedBy.tag}** — ${reason}\nCe salon sera supprimé dans quelques secondes…`)
        .setColor(0x64748b)
    ]
  })

  setTimeout(() => {
    channel.delete('Ticket fermé').catch(() => {})
  }, 5000).unref?.()
}

export async function handleTicketOpenButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('ticket_open:')) return false
  const typeKey = interaction.customId.slice('ticket_open:'.length)
  return createTicket(interaction, typeKey)
}

export async function handleTicketButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('ticket_')) return false

  if (interaction.customId.startsWith('ticket_open:')) {
    return handleTicketOpenButton(interaction)
  }

  const [action, channelId] = interaction.customId.split(':')
  if (!channelId) return false

  const ticket = getTicketByChannel(channelId)
  const channel = interaction.channel
  const member = interaction.member

  if (action === 'ticket_claim') {
    if (!isStaff(member)) {
      await interaction.reply({ content: 'Réservé à l\'équipe modération.', ephemeral: true })
      return true
    }
    if (ticket) ticket.claimedBy = interaction.user.id
    await interaction.update({
      components: [buildTicketControlRow(channelId, interaction.user.id)]
    })
    await channel.send(`✋ **${interaction.user.tag}** a pris en charge ce ticket.`)
    return true
  }

  if (action === 'ticket_close') {
    const isOwner = ticket?.ownerId === interaction.user.id
    if (!isOwner && !isStaff(member)) {
      await interaction.reply({ content: 'Seul l\'auteur du ticket ou le staff peut fermer.', ephemeral: true })
      return true
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_confirm:${channelId}`)
        .setLabel('Confirmer la fermeture')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_close_cancel:${channelId}`)
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Secondary)
    )
    await interaction.reply({
      content: 'Confirmer la fermeture de ce ticket ?',
      components: [row],
      ephemeral: true
    })
    return true
  }

  if (action === 'ticket_close_confirm') {
    const targetChannel = interaction.guild.channels.cache.get(channelId) ?? interaction.channel
    await interaction.update({ content: 'Fermeture en cours…', components: [] })
    await closeTicket(targetChannel, interaction.user, 'Fermé via le bouton')
    return true
  }

  if (action === 'ticket_close_cancel') {
    await interaction.update({ content: 'Fermeture annulée.', components: [] })
    return true
  }

  return false
}

export async function handleTicketPanelCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Permission Administrateur requise.', ephemeral: true })
    return true
  }

  const posted = await postTicketPanel(interaction.channel)
  await interaction.reply({
    content: posted
      ? '✅ Panel de tickets publié dans ce salon.'
      : 'ℹ️ Un panel existe déjà récemment dans ce salon.',
    ephemeral: true
  })
  return true
}

export async function handleTicketCloseCommand(interaction) {
  const ticket = getTicketByChannel(interaction.channelId)
  const isOwner = ticket?.ownerId === interaction.user.id

  if (!ticket && !interaction.channel.name.startsWith('ticket-')) {
    await interaction.reply({ content: 'Cette commande doit être utilisée dans un salon ticket.', ephemeral: true })
    return true
  }

  if (!isOwner && !isStaff(interaction.member)) {
    await interaction.reply({ content: 'Seul l\'auteur ou le staff peut fermer ce ticket.', ephemeral: true })
    return true
  }

  const reason = interaction.options.getString('raison') ?? 'Fermé via commande'
  await interaction.reply({ content: '🔒 Fermeture du ticket…', ephemeral: true })
  await closeTicket(interaction.channel, interaction.user, reason)
  return true
}

export async function handleTicketAddCommand(interaction) {
  if (!isStaff(interaction.member)) {
    await interaction.reply({ content: 'Réservé au staff.', ephemeral: true })
    return true
  }

  const user = interaction.options.getUser('membre', true)
  await interaction.channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  })
  await interaction.reply({ content: `✅ ${user} ajouté au ticket.`, ephemeral: true })
  return true
}

export async function handleTicketRemoveCommand(interaction) {
  if (!isStaff(interaction.member)) {
    await interaction.reply({ content: 'Réservé au staff.', ephemeral: true })
    return true
  }

  const user = interaction.options.getUser('membre', true)
  const ticket = getTicketByChannel(interaction.channelId)
  if (ticket?.ownerId === user.id) {
    await interaction.reply({ content: 'Impossible de retirer l\'auteur du ticket.', ephemeral: true })
    return true
  }

  await interaction.channel.permissionOverwrites.delete(user.id)
  await interaction.reply({ content: `✅ ${user} retiré du ticket.`, ephemeral: true })
  return true
}

/** Ré-enregistre les tickets existants après redémarrage du bot. */
export async function hydrateTicketsFromGuild(guild) {
  const category = findTicketCategory(guild)
  if (!category) return 0

  let count = 0
  for (const channel of category.children.cache.values()) {
    if (!channel.isTextBased() || !channel.name.startsWith('ticket-')) continue

    const m = channel.name.match(/^ticket-(\d+)-/)
    const number = m ? Number.parseInt(m[1], 10) : 0
    let ownerId = null
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (ow.type === OverwriteType.Member && ow.allow.has(PermissionFlagsBits.ViewChannel)) {
        ownerId = id
        break
      }
    }

    const typeKey = channel.topic?.includes('Bug') ? 'bug'
      : channel.topic?.includes('Widgets') ? 'widgets'
        : channel.topic?.includes('Application') ? 'app'
          : 'other'

    registerTicket(channel.id, {
      channelId: channel.id,
      ownerId,
      type: typeKey,
      number,
      createdAt: channel.createdTimestamp,
      claimedBy: null
    })
    count++
  }
  return count
}
