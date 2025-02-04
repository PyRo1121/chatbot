import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load templates
const templates = {
  title: readFileSync(join(__dirname, '../templates', 'title.txt'), 'utf8'),
  chat: readFileSync(join(__dirname, '../templates', 'chat.txt'), 'utf8'),
  alert: readFileSync(join(__dirname, '../templates', 'alert.txt'), 'utf8'),
  queue: readFileSync(join(__dirname, '../templates', 'queue.txt'), 'utf8'),
};

// Create WebSocket server
const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
  console.log('New overlay client connected');

  ws.on('close', () => {
    console.log('Overlay client disconnected');
  });
});

function renderTemplate(templateName, data) {
  let content = templates[templateName];
  for (const [key, value] of Object.entries(data)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return content;
}

function broadcastUpdate(content) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocketServer.OPEN) {
      client.send(content);
    }
  });
}

export { renderTemplate, broadcastUpdate };
