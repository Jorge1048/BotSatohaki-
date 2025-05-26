// lib/simple.js
import makeWASocket, { proto } from '@whiskeysockets/baileys'

export function protoType() {
  proto.WebMessageInfo.prototype.isGroup = function () {
    return this.key.remoteJid.endsWith('@g.us')
  }
}

export function serialize() {
  // Puedes dejarlo vacío si no usas serialización personalizada
}

export { makeWASocket } // ¡Esto es lo que te falta!
