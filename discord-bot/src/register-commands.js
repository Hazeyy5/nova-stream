/**
 * Enregistre les slash commands sur le serveur Nova Stream sans lancer le bot.
 * Usage : npm run register
 */
import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { commands } from './commands.js'
import { assertConfig, TOKEN, GUILD_ID } from './config.js'

assertConfig()

const rest = new REST({ version: '10' }).setToken(TOKEN)

const appId = process.env.DISCORD_CLIENT_ID?.trim() || '1519758833939906770'

await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands })
const list = await rest.get(Routes.applicationGuildCommands(appId, GUILD_ID))

console.log(`[Nova Discord] ${list.length} commande(s) sur le serveur ${GUILD_ID} :`)
for (const cmd of list) {
  console.log(`  • /${cmd.name}`)
}
