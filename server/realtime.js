// Server-Sent Events (SSE) Manager for EasyGrow Real-Time Push
const clients = new Set();

function handleSSEConnection(req, res, user) {
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'No autenticado.' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Content-Type-Options': 'nosniff'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Conexión en tiempo real establecida', userId: user.userId })}\n\n`);

  const client = { res, user };
  clients.add(client);

  req.on('close', () => {
    clients.delete(client);
  });
}

function broadcast(eventType, data) {
  const payload = `data: ${JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch (e) {
      clients.delete(client);
    }
  }
}

// Heartbeat every 20 seconds to keep connection alive through proxies
setInterval(() => {
  for (const client of clients) {
    try {
      client.res.write(`: heartbeat\n\n`);
    } catch (e) {
      clients.delete(client);
    }
  }
}, 20000);

module.exports = {
  handleSSEConnection,
  broadcast,
  getClientCount: () => clients.size
};
