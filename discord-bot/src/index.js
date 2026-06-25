import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  PermissionFlagsBits
} from 'discord.js'
import { assertToken, TOKEN, GUILD_ID } from './config.js'
import { commands, handleInteraction } from './commands.js'
import { isEmptyServer, runServerSetup } from './setup.js'

assertToken()

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN)
  const appId = client.user.id

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands })
    console.log(`[Nova Discord] Commandes enregistrées sur le serveur ${GUILD_ID}`)
  } else {
    await rest.put(Routes.applicationCommands(appId), { body: commands })
    console.log('[Nova Discord] Commandes globales enregistrées (propagation jusqu\'à 1 h)')
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[Nova Discord] Connecté en tant que ${c.user.tag}`)
  try {
    await registerSlashCommands()
  } catch (err) {
    console.error('[Nova Discord] Enregistrement commandes échoué:', err)
  }
})

client.on(Events.GuildCreate, async (guild) => {
  if (!isEmptyServer(guild)) return

  const me = await guild.members.fetchMe().catch(() => null)
  if (!me?.permissions.has(PermissionFlagsBits.Administrator)) {
    console.log(`[Nova Discord] Serveur ${guild.name} : pas admin — setup manuel via /nova-setup`)
    return
  }

  console.log(`[Nova Discord] Nouveau serveur vide détecté : ${guild.name} — setup auto…`)
  try {
    const result = await runServerSetup(guild)
    console.log(`[Nova Discord] Setup auto OK : ${result.channels} salons créés`)
  } catch (err) {
    console.warn('[Nova Discord] Setup auto échoué:', err instanceof Error ? err.message : err)
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction)
  } catch (err) {
    console.error('[Nova Discord] Interaction error:', err)
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Erreur interne.', ephemeral: true }).catch(() => {})
    }
  }
})

client.login(TOKEN)
