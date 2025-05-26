// index.js
import './config.js'
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import chalk from 'chalk'
import pino from 'pino'
import fs from 'fs'
import readline from 'readline'

// Extiende Baileys
import { protoType, serialize } from './lib/simple.js'
protoType()
serialize()

// Configura readline
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (text) => new Promise(resolve => rl.question(text, resolve))

async function start() {
  // Estado de autenticación
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  // Selección de modo
  const sessionExists = fs.existsSync('./sessions/creds.json')
  let mode = '1'
  let phoneNumber
  if (!sessionExists) {
    mode = (await ask(
      chalk.magenta('Selecciona modo de conexión:\n1. QR\n2. Código de emparejamiento\n--> ')
    )).trim()

    if (mode === '2') {
      phoneNumber = (await ask(
        chalk.green('Ingresa tu número completo (ej: 573245451694): ')
      )).replace(/\D/g, '')
    }
  }

  // Cierra readline (ya no se necesita)
  rl.close()

  // Crea conexión
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false,
    markOnlineOnConnect: true,
  })

  sock.ev.on('creds.update', saveCreds)

  // Manejo de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // Modo QR
    if (qr && mode === '1') {
      console.log(chalk.yellow('\nEscanea este código QR (expira en 45s):'))
      qrcode.generate(qr, { small: true })
    }

    // Conexión abierta
    if (connection === 'open') {
      console.log(chalk.green('\n✔ Conectado!'))
      // Modo código de emparejamiento
      if (mode === '2' && phoneNumber) {
        try {
          const pairingRaw = await sock.requestPairingCode(phoneNumber)
          const pairingCode = pairingRaw.match(/.{1,4}/g).join('-')
          console.log(
            chalk.bgMagenta.white(' Código de emparejamiento: '),
            chalk.white(pairingCode)
          )
        } catch (err) {
          console.error(chalk.red('Error generando código:'), err)
        }
      }
    }

    // Reconexión automática
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log(chalk.red('Conexión cerrada. Reconectando...'))
        start()
      } else {
        console.log(chalk.red('Sesión cerrada. Elimina sessions/creds.json y reinicia.'))
      }
    }
  })

  // Comandos
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return

    const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
    const from = m.key.remoteJid
    const isGroup = from.endsWith('@g.us')

    if (text.startsWith('.chatgpt')) {
      const prompt = text.slice(9).trim()
      const reply = await chatGPTResponse(prompt)
      await sock.sendMessage(from, { text: reply }, { quoted: m })
    }

    if (text.startsWith('.etiquetar') && isGroup) {
      const meta = await sock.groupMetadata(from)
      const mentions = meta.participants.map(p => p.id)
      await sock.sendMessage(
        from,
        { text: '🔖 Etiquetando a todos', mentions },
        { quoted: m }
      )
    }
  })
}

// Simula respuesta de ChatGPT
async function chatGPTResponse(prompt) {
  return `🤖 Respuesta simulada a: "${prompt}"`
}

start().catch(err => console.error(err))
      
