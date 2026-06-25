import {
  ChannelType,
  PermissionFlagsBits,
  OverwriteType
} from 'discord.js'
import { SETUP_MARKER, WEBSITE_URL, GITHUB_URL } from './config.js'

const ROLE_DEFS = [
  { name: 'Nova Admin', color: 0x7c3aed, hoist: true },
  { name: 'Modérateur', color: 0x5865f2, hoist: true },
  { name: 'Streamer', color: 0x9146ff, hoist: true },
  { name: 'Membre', color: 0x2ecc71, hoist: false },
  { name: 'Bot', color: 0x95a5a6, hoist: false }
]

const STRUCTURE = [
  {
    name: '📢 INFORMATIONS',
    channels: [
      { name: 'bienvenue', type: ChannelType.GuildText, topic: 'Bienvenue sur le serveur Nova Stream !' },
      { name: 'annonces', type: ChannelType.GuildText, topic: 'Annonces officielles Nova Stream', staffOnly: true },
      { name: 'mises-a-jour', type: ChannelType.GuildText, topic: 'Notes de version et changelog', staffOnly: true }
    ]
  },
  {
    name: '💬 COMMUNAUTÉ',
    channels: [
      { name: 'général', type: ChannelType.GuildText, topic: 'Discussion libre entre streamers et viewers' },
      { name: 'partage-clips', type: ChannelType.GuildText, topic: 'Partagez vos meilleurs moments' },
      { name: 'setup-stream', type: ChannelType.GuildText, topic: 'Conseils OBS, Nova Stream, overlays et widgets' }
    ]
  },
  {
    name: '🎬 NOVA STREAM',
    channels: [
      { name: 'aide-app', type: ChannelType.GuildText, topic: 'Support application desktop Nova Stream' },
      { name: 'widgets-dons', type: ChannelType.GuildText, topic: 'Alertes, dons PayPal, Giphy, widgets web' },
      { name: 'retours-suggestions', type: ChannelType.GuildText, topic: 'Idées et retours pour améliorer Nova Stream' }
    ]
  },
  {
    name: '🔧 SUPPORT',
    channels: [
      { name: 'support', type: ChannelType.GuildText, topic: 'Ouvrez un fil pour obtenir de l\'aide' },
      { name: 'bugs', type: ChannelType.GuildText, topic: 'Signalez un bug (version app + étapes)' }
    ]
  },
  {
    name: '🎙️ VOCAL',
    channels: [
      { name: 'Salon vocal', type: ChannelType.GuildVoice },
      { name: 'Stream ensemble', type: ChannelType.GuildVoice }
    ]
  }
]

function findByName(collection, name) {
  return collection.find((item) => item.name.toLowerCase() === name.toLowerCase())
}

async function ensureRoles(guild, me) {
  const roles = {}
  for (const def of ROLE_DEFS) {
    let role = findByName(guild.roles.cache, def.name)
    if (!role) {
      role = await guild.roles.create({
        name: def.name,
        color: def.color,
        hoist: def.hoist,
        mentionable: def.name === 'Streamer',
        reason: SETUP_MARKER
      })
    }
    roles[def.name] = role
  }

  if (roles['Bot'] && me) {
    await me.roles.add(roles['Bot']).catch(() => {})
  }

  return roles
}

function staffOverwrites(everyone, modRole, adminRole) {
  return [
    { id: everyone.id, deny: [PermissionFlagsBits.SendMessages], type: OverwriteType.Role },
    { id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages], type: OverwriteType.Role },
    { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages], type: OverwriteType.Role }
  ]
}

async function ensureStructure(guild, roles) {
  const everyone = guild.roles.everyone
  const created = { categories: 0, channels: 0, skipped: 0 }

  for (const block of STRUCTURE) {
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === block.name
    )
    if (!category) {
      category = await guild.channels.create({
        name: block.name,
        type: ChannelType.GuildCategory,
        reason: SETUP_MARKER
      })
      created.categories++
    }

    for (const ch of block.channels) {
      const existing = guild.channels.cache.find(
        (c) => c.parentId === category.id && c.name === ch.name
      )
      if (existing) {
        created.skipped++
        continue
      }

      const options = {
        name: ch.name,
        type: ch.type,
        parent: category.id,
        topic: ch.topic,
        reason: SETUP_MARKER
      }

      if (ch.staffOnly && roles['Modérateur'] && roles['Nova Admin']) {
        options.permissionOverwrites = staffOverwrites(everyone, roles['Modérateur'], roles['Nova Admin'])
      }

      await guild.channels.create(options)
      created.channels++
    }
  }

  return created
}

async function postWelcomeEmbed(guild) {
  const channel =
    guild.channels.cache.find((c) => c.name === 'bienvenue' && c.isTextBased()) ||
    guild.systemChannel

  if (!channel?.isTextBased()) return false

  const recent = await channel.messages.fetch({ limit: 5 }).catch(() => null)
  if (recent?.some((m) => m.author.id === guild.client.user.id && m.embeds[0]?.footer?.text === SETUP_MARKER)) {
    return false
  }

  await channel.send({
    embeds: [{
      title: '🚀 Bienvenue sur Nova Stream',
      description: [
        'Serveur communautaire pour l\'application de streaming **Nova Stream** — alternative légère à Streamlabs OBS.',
        '',
        `🌐 **Site** : ${WEBSITE_URL}`,
        `📦 **GitHub** : ${GITHUB_URL}`,
        '',
        '**Par où commencer ?**',
        '• `#setup-stream` — conseils de configuration',
        '• `#widgets-dons` — alertes, dons et Giphy',
        '• `#retours-suggestions` — proposez des améliorations',
        '',
        'Utilisez `/nova-info` pour les liens utiles.'
      ].join('\n'),
      color: 0x9146ff,
      footer: { text: SETUP_MARKER }
    }]
  })
  return true
}

export function isEmptyServer(guild) {
  const nonCategory = guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory)
  return nonCategory.size <= 3
}

export async function runServerSetup(guild) {
  const me = await guild.members.fetchMe()
  if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Le bot doit avoir la permission **Administrateur** pour créer rôles et salons.')
  }

  await guild.channels.fetch().catch(() => {})
  await guild.roles.fetch().catch(() => {})

  const roles = await ensureRoles(guild, me)
  const counts = await ensureStructure(guild, roles)
  const welcomed = await postWelcomeEmbed(guild)

  return { roles: Object.keys(roles).length, ...counts, welcomed }
}
