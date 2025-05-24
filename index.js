import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return

    const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
    
    if (text.toLowerCase() === '!tagall') {
      const metadata = await sock.groupMetadata(m.key.remoteJid)
      const participants = metadata.participants.map(p => p.id)

      await sock.sendMessage(m.key.remoteJid, {
        text: 'Etiquetas',
        mentions: participants
      }, { quoted: m })
    }
  })
}

startBot()
