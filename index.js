// index.js
import './config.js'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from '@whiskeysockets/baileys'
import { protoType, serialize } from './lib/simple.js'
import pino from 'pino'
import chalk from 'chalk'
import fs from 'fs'
import readline from 'readline'

// Inicializa extensiones de baileys
protoType()
serialize()

// Helper para leer consola
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function start() {
  // Prepara estado de autenticación
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  // Determina modo de conexión y número
  let modeQR = true
  let phoneNumber
  if (!fs.existsSync('./sessions/creds.json')) {
    const opt = await question(
      chalk.magenta('Selecciona modo de conexión:\n1. QR\n2. Código de emparejamiento\n--> ')
    )
    modeQR = opt.trim() === '1'
    if (!modeQR) {
      const num = await question(
        chalk.green('Ingresa tu número (ej: 573245451694): ')
      )
      phoneNumber = num.replace(/\D/g, '')
    }
  }

  rl.close()

  // Configuración de conexión
  const conn = makeWASocket({
    version,
    printQRInTerminal: modeQR,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    markOnlineOnConnect: true,
  })

  conn.ev.on('creds.update', saveCreds)

  // Maneja actualizaciones de conexión
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && modeQR) {
      console.log(chalk.yellow('\nEscanea el código QR (vence en 45s)'))
    }

    if (connection === 'open') {
      console.log(chalk.green('\n✔ Conectado! Bot activo.'))
      // Si modo código, solicita emparejamiento
      if (!modeQR && phoneNumber) {
        try {
          const raw = await conn.requestPairingCode(phoneNumber)
          const code = raw.match(/.{1,4}/g).join('-')
          console.log(chalk.bgMagenta.white(' Código de emparejamiento: '), chalk.white(code))
        } catch (e) {
          console.error('Error al solicitar código:', e)
        }
      }
    }

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode
      if (status !== DisconnectReason.loggedOut) {
        console.log(chalk.red('Conexión cerrada. Reconectando...'))
        start() // reintenta
      } else {
        console.log(chalk.red('Sesión cerrada. Elimina sessions/creds.json y reinicia.'))
      }
    }
  })

  // Manejo de mensajes: .chatgpt y .etiquetar
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
      const { participants } = await conn.groupMetadata(from)
      const mentions = participants.map((p) => p.id)
      await conn.sendMessage(
        from,
        { text: '🔖 Etiquetando a todos', mentions },
        { quoted: m }
      )
    }
  })
}

// Simulación de respuesta ChatGPT
async function chatGPTResponse(prompt) {
  return `🤖 Respuesta simulada a: "${prompt}"`
}

start().catch((err) => console.error(err))
