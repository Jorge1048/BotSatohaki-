import './config.js';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import fs from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import { format } from 'util';
import pino from 'pino';
import path, { join, dirname } from 'path';
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import store from './lib/store.js';
import { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC } from '@whiskeysockets/baileys';

const { proto } = await import('@whiskeysockets/baileys');
const { CONNECTING } = ws;
const { chain } = lodash;
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Configuración inicial
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; 

global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
};

global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = { start: new Date };

const __dirname = global.__dirname(import.meta.url);
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[#./]');

// Base de datos
global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile('database.json'));
global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) => setInterval(async function() {
      if (!global.db.READ) {
        clearInterval(this);
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1 * 1000));
  }
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {}),
  };
  global.db.chain = chain(global.db.data);
};
loadDatabase();

// Autenticación
const { state, saveState, saveCreds } = await useMultiFileAuthState(global.sessions);
const msgRetryCounterMap = MessageRetryMap => { };
const msgRetryCounterCache = new NodeCache();
const { version } = await fetchLatestBaileysVersion();

// Configuración de conexión
const connectionOptions = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: true,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
  },
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: true,
  getMessage: async (clave) => {
    const jid = jidNormalizedUser(clave.remoteJid);
    const msg = await store.loadMessage(jid, clave.id);
    return msg?.message || "";
  },
  version
};

global.conn = makeWASocket(connectionOptions);

// Manejadores de eventos
conn.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  
  if (connection === 'close') {
    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    console.log(chalk.bold.yellow(`Conexión cerrada. ${shouldReconnect ? 'Reconectando...' : 'Elimina la carpeta sessions y escanea QR nuevamente'}`));
    if (shouldReconnect) setTimeout(startBot, 5000);
  }

  if (connection === 'open') {
    console.log(chalk.bold.green('Bot conectado exitosamente!'));
    await conn.sendMessage(global.owner[0], { text: '✅ Bot activado' });
  }
});

conn.ev.on('creds.update', saveCreds);
conn.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
  const command = body.startsWith(global.prefix) ? body.slice(global.prefix.source.length).trim().split(/ +/).shift().toLowerCase() : '';
  
  // Sistema de comandos
  switch(command) {
    case 'ping':
      await conn.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
      break;
      
    case 'infobot':
      await conn.sendMessage(msg.key.remoteJid, { 
        text: `🤖 *Información del Bot*\n\n` +
              `Creador: ${global.owner}\n` +
              `Versión: 2.0\n` +
              `Estado: Activo`
      });
      break;
  }
});

// Iniciar bot
async function startBot() {
  await loadDatabase();
  console.log(chalk.bold.magenta('Iniciando bot...'));
}

startBot().catch(err => {
  console.error(chalk.bold.red('Error al iniciar el bot:'), err);
  process.exit(1);
});

// Mantener el proceso activo
process.on('uncaughtException', console.error);
