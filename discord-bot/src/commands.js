import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js'
import { runServerSetup } from './setup.js'
import { WEBSITE_URL, GITHUB_URL, isNovaGuild } from './config.js'

export const commands = [
  new SlashCommandBuilder()
    .setName('nova-setup')
    .setDescription('[Admin] (Re)génère la structure du serveur Nova Stream')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('nova-info')
    .setDescription('Liens utiles Nova Stream')
].map((c) => c.toJSON())

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return false
  if (!interaction.guildId || !isNovaGuild(interaction.guildId)) {
    await interaction.reply({ content: 'Ce bot est réservé au serveur Nova Stream.', ephemeral: true })
    return true
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
    await interaction.reply({ embeds: [embed] })
    return true
  }

  return false
}
