// index.js

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

import './config.js'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import yargs from 'yargs'
import pino from 'pino'
import chalk from 'chalk'
import qrcode from 'qrcode-terminal'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } from '@whiskeysockets/baileys'
import { protoType, serialize } from './lib/simple.js'

// Extiende Baileys
protoType()
serialize()

// Helpers globales
const __filename = (pathURL = import.meta.url) => platform !== 'win32' ? fileURLToPath(pathURL) : pathToFileURL(pathURL).toString()
const __dirname = (pathURL) => path.dirname(__filename(pathURL))
const require = createRequire(import.meta.url)

// Parámetros y opciones
const opts = yargs(process.argv.slice(2)).option('code', { type: 'boolean' }).argv
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (text) => new Promise(res => rl.question(text, res))

async function startBot() {
  // Autenticación
  const { state, saveCreds } = await useMultiFileAuthState('./sessions')
  const { version } = await fetchLatestBaileysVersion()

  // Selección de modo
  let mode = opts.code ? 'code' : null
  if (!mode) {
    const m = await ask(chalk.magenta('Selecciona modo de conexión:\n1) QR   2) Código de emparejamiento\n--> '))
    mode = m.trim() === '2' ? 'code' : 'qr'
  }

  // En modo código, pide número
  let phone = null
  if (mode === 'code') {
    const num = await ask(chalk.green('Ingresa tu número completo (ej: 573245451694): '))
    phone = num.replace(/\D/g, '')
  }
  rl.close()

  // Conexión
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    markOnlineOnConnect: true,
  })
  sock.ev.on('creds.update', saveCreds)

  // Evento de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (mode === 'qr' && qr) {
      console.log(chalk.yellow('Escanea este código QR (expira en 45s):'))
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') {
      console.log(chalk.green('✔ Conectado!'))
      if (mode === 'code' && phone) {
        try {
          const raw = await sock.requestPairingCode(phone)
          const code = raw.match(/.{1,4}/g).join('-')
          console.log(chalk.bgMagenta.white(' Código de emparejamiento: '), chalk.white(code))
        } catch (e) {
          console.error(chalk.red('Error generando código:'), e)
        }
      }
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log(chalk.red('Desconectado, reintentando...'))
        startBot()
      } else {
        console.log(chalk.red('Sesión cerrada. Elimina sessions/creds.json y reinicia.'))
      }
    }
  })

  // Manejo de mensajes
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
      await sock.sendMessage(from, { text: '🔖 Etiquetando a todos', mentions }, { quoted: m })
    }
  })
}

// Simula respuesta ChatGPT
async function chatGPTResponse(prompt) {
  return `🤖 Respuesta simulada a: "${prompt}"`
}

startBot().catch(console.error)
        
