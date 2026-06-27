import http from 'http'
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events
} from 'discord.js'
import { assertConfig, TOKEN, GUILD_ID } from './config.js'
import { commands, handleInteraction } from './commands.js'

assertConfig()

/** Port HTTP pour les hébergeurs cloud (health check, évite le « sleep »). */
const HEALTH_PORT = Number(process.env.PORT) || 8080
http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Nova Stream Discord bot OK\n')
  })
  .listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[Nova Discord] Health check : http://0.0.0.0:${HEALTH_PORT}`)
  })

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN)
  const appId = client.user.id

  await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands })
  console.log(`[Nova Discord] Commandes enregistrées sur le serveur ${GUILD_ID}`)
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[Nova Discord] Connecté en tant que ${c.user.tag} — serveur ${GUILD_ID}`)
  try {
    await registerSlashCommands()
  } catch (err) {
    console.error('[Nova Discord] Enregistrement commandes échoué:', err)
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
