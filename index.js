import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys'

async function startBot() {
  // Autenticación para guardar sesión
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if(connection === 'close') {
      console.log('Desconectado, intentando reconectar...')
      if(lastDisconnect.error.output.statusCode !== 401) {
        startBot()
      }
    } else if(connection === 'open') {
      console.log('Bot conectado correctamente')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if(!msg.message) return
    const isGroup = msg.key.remoteJid.endsWith('@g.us')
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

    if(text === '!tagall' && isGroup) {
      const groupMetadata = await sock.groupMetadata(msg.key.remoteJid)
      const participants = groupMetadata.participants.map(p => p.id)
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Hola a todos!',
        mentions: participants
      })
    }
  })
}

startBot()
