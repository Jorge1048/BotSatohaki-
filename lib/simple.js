// lib/simple.js
import { proto } from '@whiskeysockets/baileys'

export function protoType() {
  proto.WebMessageInfo.prototype.isGroup = function () {
    return this.key.remoteJid.endsWith('@g.us')
  }
}

export function serialize() {}
