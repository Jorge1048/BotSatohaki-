// plugins etiquetar
export default async function (m, { conn }) {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: 'Este comando solo funciona en grupos.' }, { quoted: m })
  const participants = await conn.groupMetadata(m.chat)
  const mentions = participants.participants.map(p => p.id)
  return conn.sendMessage(m.chat, { text: 'Etiquetando a todos:', mentions }, { quoted: m })
}
