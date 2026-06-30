import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js'
import { runServerSetup } from './setup.js'
import { WEBSITE_URL, GITHUB_URL, isNovaGuild } from './config.js'
import { handlePollCommand, handlePollButton } from './polls.js'
import { handleNovaStatusCommand } from './status.js'
import {
  handleTicketButton,
  handleTicketPanelCommand,
  handleTicketCloseCommand,
  handleTicketAddCommand,
  handleTicketRemoveCommand
} from './tickets.js'

function buildPollSlash(name) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Créer un sondage dans ce salon')
    .addStringOption((o) =>
      o.setName('question').setDescription('Question du sondage').setRequired(true).setMaxLength(300)
    )
    .addStringOption((o) =>
      o.setName('option1').setDescription('Réponse 1').setRequired(true).setMaxLength(55)
    )
    .addStringOption((o) =>
      o.setName('option2').setDescription('Réponse 2').setRequired(true).setMaxLength(55)
    )
    .addStringOption((o) =>
      o.setName('option3').setDescription('Réponse 3 (optionnel)').setRequired(false).setMaxLength(55)
    )
    .addStringOption((o) =>
      o.setName('option4').setDescription('Réponse 4 (optionnel)').setRequired(false).setMaxLength(55)
    )
    .addStringOption((o) =>
      o.setName('option5').setDescription('Réponse 5 (optionnel)').setRequired(false).setMaxLength(55)
    )
    .addIntegerOption((o) =>
      o
        .setName('duree')
        .setDescription('Durée en heures (défaut : 24, max : 168)')
        .setMinValue(1)
        .setMaxValue(168)
        .setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName('multi').setDescription('Autoriser plusieurs réponses par personne').setRequired(false)
    )
}

export const commands = [
  new SlashCommandBuilder()
    .setName('nova-setup')
    .setDescription('[Admin] (Re)génère la structure du serveur Nova Stream')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('nova-info')
    .setDescription('Liens utiles Nova Stream'),

  new SlashCommandBuilder()
    .setName('nova-status')
    .setDescription('Statut des services Nova Stream (site, API dons, version)'),

  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('[Admin] Publie le panel d\'ouverture de tickets dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Fermer le ticket en cours')
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison de la fermeture').setRequired(false).setMaxLength(200)
    ),

  new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('[Staff] Ajouter un membre au ticket')
    .addUserOption((o) => o.setName('membre').setDescription('Membre à ajouter').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('[Staff] Retirer un membre du ticket')
    .addUserOption((o) => o.setName('membre').setDescription('Membre à retirer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  buildPollSlash('sondage'),
  buildPollSlash('nova-sondage')
].map((c) => c.toJSON())

const POLL_COMMANDS = new Set(['sondage', 'nova-sondage'])
const TICKET_COMMANDS = new Set(['ticket-panel', 'ticket-close', 'ticket-add', 'ticket-remove'])

export async function handleInteraction(interaction) {
  if (await handleTicketButton(interaction)) return true
  if (await handlePollButton(interaction)) return true

  if (!interaction.isChatInputCommand()) return false
  if (!interaction.guildId || !isNovaGuild(interaction.guildId)) {
    await interaction.reply({ content: 'Ce bot est réservé au serveur Nova Stream.', ephemeral: true })
    return true
  }

  if (POLL_COMMANDS.has(interaction.commandName)) {
    return handlePollCommand(interaction)
  }

  if (TICKET_COMMANDS.has(interaction.commandName)) {
    switch (interaction.commandName) {
      case 'ticket-panel':
        return handleTicketPanelCommand(interaction)
      case 'ticket-close':
        return handleTicketCloseCommand(interaction)
      case 'ticket-add':
        return handleTicketAddCommand(interaction)
      case 'ticket-remove':
        return handleTicketRemoveCommand(interaction)
    }
  }

  if (interaction.commandName === 'nova-setup') {
    await interaction.deferReply({ ephemeral: true })
    try {
      const result = await runServerSetup(interaction.guild)
      await interaction.editReply({
        content: [
          '✅ **Serveur Nova Stream configuré !**',
          `• Rôles : ${result.roles}`,
          `• Catégories créées : ${result.categories}`,
          `• Salons créés : ${result.channels}`,
          `• Salons déjà existants (ignorés) : ${result.skipped}`,
          result.welcomed ? '• Message de bienvenue posté dans `#bienvenue`' : '',
          result.ticketPanel ? '• Panel de tickets publié dans `#ouvrir-ticket`' : ''
        ].filter(Boolean).join('\n')
      })
    } catch (err) {
      await interaction.editReply({
        content: `❌ ${err instanceof Error ? err.message : 'Configuration échouée'}`
      })
    }
    return true
  }

  if (interaction.commandName === 'nova-info') {
    const embed = new EmbedBuilder()
      .setTitle('Nova Stream')
      .setColor(0x9146ff)
      .setDescription('Application de streaming desktop + site web pour widgets, alertes et dons.')
      .addFields(
        { name: '🌐 Site', value: WEBSITE_URL },
        { name: '📦 GitHub', value: GITHUB_URL },
        { name: '🎫 Support', value: 'Ouvrez un ticket dans `#ouvrir-ticket` (salon privé avec l\'équipe)' },
        { name: '💰 Dons', value: 'PayPal OAuth + GIF Giphy via le dashboard web' },
        { name: '🔔 Alertes', value: 'Follow, sub, raid, bits, don — sons personnalisables' },
        { name: '📊 Sondages', value: '`/sondage` ou `/nova-sondage` — 2 à 5 options, votes par boutons' },
        { name: '📡 Statut', value: 'Utilisez `/nova-status` pour l\'état des services' }
      )
    await interaction.reply({ embeds: [embed] })
    return true
  }

  if (interaction.commandName === 'nova-status') {
    return handleNovaStatusCommand(interaction)
  }

  return false
}
