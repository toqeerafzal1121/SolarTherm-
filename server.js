const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3002;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// In-memory IoT telemetry state from shelter sensors
let telemetryState = {
  deviceId: 'SOLARTHERM-NODE-01',
  connected: true,
  lastUpdated: new Date().toISOString(),
  indoorTemp: 18.4,    // °C
  outdoorTemp: -21.8,  // °C
  solarGHI: 580,       // W/m²
  humidity: 34,        // %
  pressure: 66.5,      // kPa (Leh 3,505m)
  airQualityPPM: 412,  // CO2 ppm
  storageTemp: 19.6    // °C
};

const server = http.createServer((req, res) => {
  // CORS Headers for multi-device & IoT support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API Endpoint: Telemetry Data
  if (pathname === '/api/telemetry') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(telemetryState));
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          telemetryState = {
            ...telemetryState,
            ...parsed,
            lastUpdated: new Date().toISOString(),
            connected: true
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'success', telemetry: telemetryState }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // 2. API Endpoint: Device Info & Status
  if (pathname === '/api/device') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      system: 'SOLARTHERM SIH26051 Field Node',
      version: '1.0.0',
      connectedDevices: [
        { id: 'SHT31-TEMP-HUMIDITY', type: 'I2C Temperature & Humidity Sensor', status: 'ACTIVE' },
        { id: 'DS18B20-ARRAY', type: '1-Wire PCM Thermal Storage Probes', status: 'ACTIVE' },
        { id: 'PYR-PYRANOMETER', type: 'Solar Irradiance Flux Sensor', status: 'ACTIVE' }
      ],
      network: getLocalIPs()
    }));
  }

  // 3. Static Files
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  // Security check: ensure path is within PUBLIC_DIR
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${pathname}`);
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });

    fs.createReadStream(safePath).pipe(res);
  });
});

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`[SOLARTHERM SIH26051 Server] Listening on all network interfaces.`);
    console.log(`  Local:   http://localhost:${port}/`);
    ips.forEach(ip => {
      console.log(`  Network: http://${ip}:${port}/ (Accessible from other devices on Wi-Fi)`);
    });
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
