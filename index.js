import pkg from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = pkg;
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: { level: 'silent' },
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('[!] Escanea este código QR:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[!] Conexión cerrada. Reintentando...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        }

        if (connection === 'open') {
            console.log('[!] Bot conectado exitosamente.');
        }
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;

        if (body.startsWith('.chatgpt')) {
            await sock.sendMessage(sender, { text: '¡Hola! Soy un bot funcional.' });
        }

        if (body.startsWith('.etiquetar') && msg.message?.extendedTextMessage?.contextInfo?.participant) {
            const group = msg.key.remoteJid;
            const groupMetadata = await sock.groupMetadata(group);
            const mentions = groupMetadata.participants.map(p => p.id);
            await sock.sendMessage(group, {
                text: 'Hola a todos!',
                mentions
            });
        }
    });
}

startBot();
