impoimport { makeWASocket, useSingleFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'

const { state, saveState } = useSingleFileAuthState('./auth_info.json')

async function startBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: { level: 'warn' }
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            console.log('\n[!] Escanea este código QR con WhatsApp:')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log(`[!] Conexión cerrada. ${shouldReconnect ? 'Reconectando...' : 'Elimina auth_info.json y reinicia'}`)
            
            if (shouldReconnect) {
                setTimeout(startBot, 5000)
            }
        }

        if (connection === 'open') {
            console.log('[+] Bot conectado correctamente')
        }
    })

    sock.ev.on('creds.update', saveState)

    // ... (resto de tu código de mensajes)

    // Manejador de mensajes
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message || msg.key.fromMe) return

            const body = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || 
                        msg.message.imageMessage?.caption || ''
            const sender = msg.key.remoteJid
            const command = body.trim().split(/ +/).shift().toLowerCase()

            // Comandos disponibles
            const commands = {
                '.chatgpt': async () => {
                    const text = body.slice(9).trim()
                    if (!text) return await sock.sendMessage(sender, { 
                        text: '⚠️ Escribe tu pregunta después de .chatgpt\nEjemplo: .chatgpt ¿Qué es el universo?' 
                    })
                    
                    await sock.sendMessage(sender, { 
                        text: `🤖 Respuesta para: *${text}*\n\n_Simulando respuesta de ChatGPT..._` 
                    })
                },

                '.etiquetar': async () => {
                    if (!msg.key.remoteJid.endsWith('@g.us')) {
                        return await sock.sendMessage(sender, { 
                            text: '⚠️ Este comando solo funciona en grupos' 
                        })
                    }

                    const groupMetadata = await sock.groupMetadata(sender)
                    const mentions = groupMetadata.participants.map(p => p.id)
                    
                    await sock.sendMessage(sender, { 
                        text: '📢 ¡Atención a todos!',
                        mentions
                    })
                },

                '.help': async () => {
                    await sock.sendMessage(sender, {
                        text: `💡 *Lista de comandos:*\n\n` +
                              `▸ .chatgpt [pregunta] - Consulta con IA\n` +
                              `▸ .etiquetar - Menciona a todos\n` +
                              `▸ .help - Muestra esta ayuda`
                    })
                }
            }

            if (commands[command]) {
                await commands[command]()
            }

        } catch (error) {
            console.error('[!] Error procesando mensaje:', error)
        }
    })
}

// Iniciar el bot con manejo de excepciones
startBot().catch(err => {
    console.error('[!] Error al iniciar el bot:', err)
    process.exit(1)
})
