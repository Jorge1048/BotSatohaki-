// index.js
import './config.js'
import pkg from '@whiskeysockets/baileys'
const { makeWASocket, protoType, serialize } = pkg
import {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import chalk from 'chalk'
import fs from 'fs'
import readline from 'readline'

// Inicializa extensiones de baileys
protoType()
serialize()

// Crea interfaz de lectura de consola\const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

// Función principal
async function startBot() {
  // Autenticación multi-archivo
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  // Pide número si no existe sesión previa
  let phoneNumber
  if (!fs.existsSync('./sessions/creds.json')) {
    phoneNumber = await question(
      chalk.green('✏  Ingresa tu número de WhatsApp (ej: 573245451694): ')
    )
    phoneNumber = phoneNumber.replace(/\D/g, '')
  }

  // Cierra lectura de consola
  rl.close()

  // Opciones de conexión
  const conn = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: !phoneNumber,
    markOnlineOnConnect: true,
  })
  conn.ev.on('creds.update', saveCreds)

  // Si se ingresó número, solicita y muestra el código
  if (phoneNumber) {
    const rawCode = await conn.requestPairingCode(phoneNumber)
    const pairingCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode
    console.log(
      chalk.bgMagenta.white('✧ CÓDIGO DE VINCULACIÓN ✧'),
      chalk.white(pairingCode)
    )
  }

  // Manejo de mensajes: solo .chatgpt y .etiquetar
  conn.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''
    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')

    if (text.startsWith('.chatgpt')) {
      const prompt = text.slice(9).trim()
      const reply = await chatGPTResponse(prompt)
      await conn.sendMessage(from, { text: reply }, { quoted: msg })
    }

    if (text.startsWith('.etiquetar') && isGroup) {
      const meta = await conn.groupMetadata(from)
      const mentions = meta.participants.map((p) => p.id)
      await conn.sendMessage(
        from,
        { text: '🔖 Etiquetando a todos:', mentions },
        { quoted: msg }
      )
    }
  })

  console.log(chalk.green('✅ Bot iniciado. Esperando mensajes...'))
}

// Función de simulación de ChatGPT (reemplaza con tu integración)
async function chatGPTResponse(prompt) {
  return `🤖 Respuesta simulada a: "${prompt}"`
}

// Arranca el bot
startBot().catch(console.error)
