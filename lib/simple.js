// lib/simple.js
import pkg from '@whiskeysockets/baileys'
const { makeWASocket, proto } = pkg
export function protoType() {
  proto.WebMessageInfo.prototype.isGroup = function () {
    return this.key.remoteJid.endsWith('@g.us')
  }
}

export function serialize() {}
export { makeWASocket }
