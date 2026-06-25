import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js'
import { runServerSetup } from './setup.js'
import { WEBSITE_URL, GITHUB_URL } from './config.js'

export const commands = [
  new SlashCommandBuilder()
    .setName('nova-setup')
    .setDescription('Configure le serveur Nova Stream (rôles, catégories, salons)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('nova-info')
    .setDescription('Liens utiles Nova Stream'),

  new SlashCommandBuilder()
    .setName('nova-aide')
    .setDescription('Guide rapide pour inviter et configurer le bot')
].map((c) => c.toJSON())

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return false

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
          result.welcomed ? '• Message de bienvenue posté dans `#bienvenue`' : ''
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
        { name: '💰 Dons', value: 'PayPal OAuth + GIF Giphy (≥ 25 €) via le dashboard web' },
        { name: '🔔 Alertes', value: 'Follow, sub, raid, don — sons personnalisables' }
      )
    await interaction.reply({ embeds: [embed], ephemeral: true })
    return true
  }

  if (interaction.commandName === 'nova-aide') {
    await interaction.reply({
      ephemeral: true,
      content: [
        '**Configurer un serveur Nova Stream**',
        '1. Créez un serveur Discord vide (Serveur privé → Pour moi et mes amis).',
        '2. Invitez le bot avec **Administrateur** (lien OAuth2 du portail développeur).',
        '3. Lancez `/nova-setup` sur ce serveur.',
        '',
        'Le bot ne peut pas créer un serveur Discord à votre place (limitation API Discord) — il configure automatiquement la structure une fois invité.'
      ].join('\n')
    })
    return true
  }

  return false
}
