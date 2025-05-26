// lib/simple.js
import makeWASocket, { proto } from '@whiskeysockets/baileys'

export function protoType() {
  proto.WebMessageInfo.prototype.isGroup = function () {
    return this.key.remoteJid.endsWith('@g.us')
  }
}

export function serialize() {}
export { makeWASocket }
