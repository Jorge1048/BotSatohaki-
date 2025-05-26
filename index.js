// index.js (solo .chatgpt y .etiquetar)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import './config.js'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } from '@whiskeysockets/baileys'
import pino from 'pino'
import chalk from 'chalk'
import fs from 'fs'
import readline from 'readline'

protoType()
serialize()

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((res) => rl.question(text, res))

const { state, saveCreds } = await useMultiFileAuthState('./sessions')
const { version } = await fetchLatestBaileysVersion()

let opcion = '1'
if (!fs.existsSync('./sessions/creds.json')) {
  opcion = await question(chalk.magenta(
    'Selecciona modo de conexión:\n1. Código QR\n2. Código de emparejamiento\n--> '
  ))
  rl.close()
}

const connectionOptions = {
  version,
  printQRInTerminal: opcion === '1',
  logger: pino({ level: 'silent' }),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
  },
  markOnlineOnConnect: true,
  browser: ['NagiBot', 'Chrome', '1.0']
}

global.conn = makeWASocket(connectionOptions)
conn.ev.on('creds.update', saveCreds)

conn.ev.on('messages.upsert', async ({ messages }) => {
  const m = messages[0]
  if (!m.message || m.key.fromMe) return

  const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
  const from = m.key.remoteJid
  const isGroup = from.endsWith('@g.us')

  if (text.startsWith('.chatgpt')) {
    const prompt = text.slice(9).trim()
    const reply = await chatGPTResponse(prompt)
    await conn.sendMessage(from, { text: reply }, { quoted: m })
  }

  if (text.startsWith('.etiquetar') && isGroup) {
    const metadata = await conn.groupMetadata(from)
    const mentions = metadata.participants.map(p => p.id)
    await conn.sendMessage(from, {
      text: '🔖 Etiquetando a todos:',
      mentions
    }, { quoted: m })
  }
})

async function chatGPTResponse(prompt) {
  return `🤖 Respuesta simulada a: "${prompt}"` // Puedes integrar tu API aquí
}
