// plugins/chatgpt.js
export default async function (m, { conn, text }) {
  if (!text) return conn.sendMessage(m.chat, { text: 'Escribe algo después de .chatgpt' }, { quoted: m })
  const respuesta = await chatGPT(text)
  return conn.sendMessage(m.chat, { text: respuesta }, { quoted: m })
}

async function chatGPT(prompt) {
  return `Respuesta simulada de ChatGPT: "${prompt}"` // Aquí iría la llamada a la API real
}
