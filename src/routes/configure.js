import express from 'express';
import { encryptConfig, decryptConfig, DEFAULT_CONFIG } from '../config.js';

const router = express.Router();

/**
 * GET / - Landing page
 */
router.get('/', (req, res) => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tubio+ — YouTube for Stremio</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #0a0a0f;
          color: #e0e0e8;
          min-height: 100vh;
          overflow-x: hidden;
        }

        body::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(102, 126, 234, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(118, 75, 162, 0.10) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(102, 126, 234, 0.06) 0%, transparent 40%);
          pointer-events: none;
          z-index: 0;
        }

        .hero {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 80px 20px 50px;
          max-width: 700px;
          margin: 0 auto;
        }

        .logo {
          width: 90px;
          height: 90px;
          margin: 0 auto 24px;
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
        }

        .logo svg {
          width: 100%;
          height: 100%;
        }

        h1 {
          font-size: 42px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff 0%, #c0c0d0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tagline {
          font-size: 17px;
          color: #8888a0;
          margin-bottom: 40px;
          line-height: 1.5;
        }

        .actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 60px;
        }

        .btn {
          padding: 14px 28px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #d0d0e0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .section {
          position: relative;
          z-index: 1;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }

        .section-title {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 24px;
          text-align: center;
          color: #d0d0e0;
        }

        .about {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 32px;
          margin-bottom: 60px;
          font-size: 15px;
          line-height: 1.8;
          color: #9898b8;
          text-align: center;
          max-width: 620px;
          margin-left: auto;
          margin-right: auto;
        }

        .about strong {
          color: #c0c0e0;
          font-weight: 600;
        }

        .deploy-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }

        .deploy-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 22px;
          text-decoration: none;
          color: inherit;
          transition: all 0.25s ease;
        }

        .deploy-card:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(102, 126, 234, 0.25);
          transform: translateY(-2px);
        }

        .deploy-card h3 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #e0e0f0;
        }

        .deploy-card p {
          font-size: 12px;
          color: #7878a0;
          line-height: 1.4;
        }

        .deploy-card .badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          margin-top: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-rec {
          background: rgba(102, 126, 234, 0.15);
          color: #8899ee;
        }

        .badge-free {
          background: rgba(46, 204, 113, 0.15);
          color: #5cd88a;
        }

        .footer {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 40px 20px;
          font-size: 13px;
          color: #505068;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .footer a {
          color: #667eea;
          text-decoration: none;
        }

        .footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .hero { padding: 50px 20px 30px; }
          h1 { font-size: 30px; }
          .tagline { font-size: 15px; }
          .actions { flex-direction: column; align-items: center; }
          .btn { width: 100%; max-width: 280px; justify-content: center; }
        }
      </style>
    </head>
    <body>
      <div class="hero">
        <div class="logo">
          <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#667eea"/>
                <stop offset="100%" stop-color="#764ba2"/>
              </linearGradient>
            </defs>
            <rect width="90" height="90" rx="22" fill="url(#bg)"/>
            <text x="18" y="64" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="52" font-weight="800" fill="white" letter-spacing="-2">T+</text>
          </svg>
        </div>
        <h1>Tubio+</h1>
        <p class="tagline">Stream YouTube directly in Stremio.<br>Built for iOS, tvOS, and web.</p>
        <div class="actions">
          <a href="/configure" class="btn btn-primary">Get Started</a>
        </div>
      </div>

      <div class="section">
        <div class="about">
          A self-hosted Stremio addon that streams YouTube content up to <strong>1080p h264</strong>,
          muxed on-the-fly with FFmpeg for full iOS and tvOS compatibility.
          Search, browse recommendations, access your subscriptions, watch history, and watch later
          with cookie authentication. Includes <strong>SponsorBlock</strong> to skip sponsors and filler,
          and <strong>DeArrow</strong> for community-sourced titles and thumbnails.
          Your config is AES-256 encrypted with a key unique to each deployment.
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Deploy Your Own</h2>
        <div class="deploy-options">
          <a href="https://github.com/cat5edopeHA/tubiopp" class="deploy-card">
            <h3>Self-Hosted</h3>
            <p>Run with Docker or Node.js directly. Requires yt-dlp and FFmpeg.</p>
            <span class="badge badge-rec">Recommended</span>
          </a>
          <a href="https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/beamup.md" class="deploy-card">
            <h3>Beamup</h3>
            <p>Free hosting built for Stremio addons. Deploy with a single command.</p>
            <span class="badge badge-free">Free</span>
          </a>
          <a href="https://www.heroku.com/" class="deploy-card">
            <h3>Heroku</h3>
            <p>Cloud platform with managed Node.js hosting and easy scaling.</p>
          </a>
        </div>
      </div>

      <div class="section">
        <div class="about" style="font-size: 13px; line-height: 1.7; color: #6868888;">
          <strong style="color: #b0b0c8;">Privacy Notice:</strong>
          If you are using a public instance of Tubio+, the server operator can access your
          decrypted cookies when making YouTube requests on your behalf. This is a fundamental
          limitation of any proxy-based service — the server must have your credentials to act
          on your behalf. Your config is AES-256 encrypted in the URL so it cannot be read
          casually, but the server decrypts it on every request. For full control over your
          data, self-host your own instance.
        </div>
      </div>

      <div class="footer">
        Inspired by <a href="https://github.com/xXCrash2BomberXx/YouTubio">YouTubio</a> &middot;
        <a href="https://github.com/cat5edopeHA/tubiopp">GitHub</a>
        <br><span style="margin-top: 8px; display: inline-block; opacity: 0.6;">vibe coded with love &hearts;</span>
      </div>
    </body>
    </html>
  `);
});

/**
 * POST /api/encrypt - Encrypt a config object and return the config string
 */
router.post('/api/encrypt', (req, res) => {
  try {
    const config = req.body;
    const configStr = encryptConfig(config);
    res.json({ config: configStr });
  } catch (err) {
    console.error('[configure] Encrypt error:', err.message);
    res.status(400).json({ error: 'Invalid config' });
  }
});

/**
 * GET /configure - Configuration form
 */
router.get('/configure', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Configure — Tubio+</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #0a0a0f;
          color: #e0e0e8;
          min-height: 100vh;
          padding: 40px 20px;
        }

        body::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(102, 126, 234, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(118, 75, 162, 0.06) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .container {
          position: relative;
          z-index: 1;
          max-width: 560px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 36px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #8888a0;
          text-decoration: none;
          font-size: 13px;
          margin-bottom: 24px;
          transition: color 0.2s;
        }

        .back-link:hover { color: #667eea; }

        h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 32px;
          text-align: center;
          background: linear-gradient(135deg, #fff 0%, #c0c0d0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .form-section {
          margin-bottom: 28px;
          padding-bottom: 28px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .form-section:last-of-type { border-bottom: none; }

        .form-section h2 {
          color: #b0b0c8;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group { margin-bottom: 14px; }

        label {
          display: block;
          margin-bottom: 6px;
          color: #c0c0d8;
          font-size: 13px;
          font-weight: 500;
        }

        input[type="text"],
        input[type="number"],
        select,
        textarea {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          color: #e0e0e8;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        textarea {
          min-height: 130px;
          resize: vertical;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        select {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238888a0'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        select option {
          background: #1a1a2e;
          color: #e0e0e8;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: rgba(102, 126, 234, 0.5);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-help {
          font-size: 12px;
          color: #6868888;
          margin-top: 6px;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .checkbox-item input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #667eea;
          cursor: pointer;
        }

        .checkbox-item label {
          margin: 0;
          display: inline;
          cursor: pointer;
          color: #c0c0d8;
        }

        .sb-categories {
          margin-top: 14px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          display: none;
        }

        .sb-categories > label {
          margin-bottom: 10px;
          font-weight: 600;
          color: #b0b0c8;
        }

        .buttons {
          display: flex;
          gap: 10px;
          margin-top: 32px;
        }

        .btn {
          flex: 1;
          padding: 13px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #c0c0d8;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        .config-link {
          margin-top: 28px;
          padding: 18px;
          background: rgba(102, 126, 234, 0.08);
          border-radius: 10px;
          border: 1px solid rgba(102, 126, 234, 0.15);
        }

        .config-link label {
          margin-bottom: 6px;
          color: #9898b8;
          font-size: 12px;
        }

        .config-value {
          word-break: break-all;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 11px;
          color: #8888a0;
          background: rgba(0, 0, 0, 0.3);
          padding: 10px;
          border-radius: 6px;
          margin-top: 8px;
          max-height: 80px;
          overflow-y: auto;
        }

        .copy-btn {
          padding: 6px 14px;
          background: rgba(102, 126, 234, 0.2);
          color: #8899ee;
          border: 1px solid rgba(102, 126, 234, 0.2);
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: rgba(102, 126, 234, 0.3);
        }

        .success {
          color: #5cd88a;
          font-size: 12px;
          margin-top: 6px;
        }

        .install-btn {
          display: block;
          text-align: center;
          margin-bottom: 14px;
          text-decoration: none;
          padding: 13px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
          transition: all 0.25s;
        }

        .install-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 600px) {
          body { padding: 20px 12px; }
          .container { padding: 24px 18px; }
          h1 { font-size: 20px; }
          .buttons { flex-direction: column; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <a href="/" class="back-link">← Back</a>
        <h1>Configure Tubio+</h1>

        <form id="configForm">
          <div class="form-section">
            <h2>YouTube Authentication</h2>
            <div class="form-group">
              <label for="cookies">Cookies (Netscape Format)</label>
              <textarea id="cookies" name="cookies" placeholder="Paste your YouTube cookies here to access subscriptions, history, and watch later..."></textarea>
              <div class="form-help">Export cookies from your browser using an extension like "Get cookies.txt LOCALLY"</div>
              <div class="form-help" style="margin-top: 8px; color: #9878a0;">If you are using a public instance, the server operator can access your cookies when making YouTube requests on your behalf. Self-host for full privacy.</div>
            </div>
          </div>

          <div class="form-section">
            <h2>Video Quality</h2>
            <div class="form-group">
              <label for="quality">Maximum Quality</label>
              <select id="quality" name="quality">
                <option value="360">360p</option>
                <option value="480">480p</option>
                <option value="720">720p</option>
                <option value="1080" selected>1080p (default)</option>
              </select>
              <div class="form-help">Videos will stream at this quality or lower depending on availability</div>
            </div>
          </div>

          <div class="form-section">
            <h2>SponsorBlock</h2>
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="sbEnabled" name="sbEnabled">
                <label for="sbEnabled">Enable SponsorBlock</label>
              </div>
              <div class="form-help">Skip sponsor segments and other non-content automatically</div>
            </div>

            <div id="sbCategories" class="sb-categories">
              <label>Skip these segment types:</label>
              <div class="checkbox-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="sbSponsor" name="sbCategories" value="sponsor" checked>
                  <label for="sbSponsor">Sponsor segments</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbSelfpromo" name="sbCategories" value="selfpromo" checked>
                  <label for="sbSelfpromo">Self-promotion</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbInteraction" name="sbCategories" value="interaction" checked>
                  <label for="sbInteraction">Interaction reminders</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbIntro" name="sbCategories" value="intro">
                  <label for="sbIntro">Intros</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbOutro" name="sbCategories" value="outro">
                  <label for="sbOutro">Outros</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbPreview" name="sbCategories" value="preview">
                  <label for="sbPreview">Preview / Recap</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbMusic" name="sbCategories" value="music_offtopic">
                  <label for="sbMusic">Off-topic music</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="sbFiller" name="sbCategories" value="filler">
                  <label for="sbFiller">Filler</label>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h2>DeArrow</h2>
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="dearrowEnabled" name="dearrowEnabled">
                <label for="dearrowEnabled">Enable DeArrow</label>
              </div>
              <div class="form-help">Replace clickbait with community-sourced titles and thumbnails</div>
            </div>
          </div>

          <div class="buttons">
            <button type="submit" class="btn btn-primary">Save & Install</button>
            <button type="button" class="btn btn-secondary" onclick="resetForm()">Reset</button>
          </div>
        </form>

        <div id="configLink" class="config-link" style="display: none;">
          <a id="installLink" href="#" class="install-btn">Install in Stremio</a>
          <label>Manifest URL:</label>
          <div class="config-value" id="configValue"></div>
          <button type="button" class="copy-btn" onclick="copyConfig()">Copy URL</button>
          <div id="copySuccess" class="success" style="display: none;">Copied!</div>
        </div>
      </div>

      <script>
        const configForm = document.getElementById('configForm');
        const sbEnabled = document.getElementById('sbEnabled');
        const sbCategories = document.getElementById('sbCategories');

        function loadConfig() {
          updateSBCategoriesVisibility();
        }

        function updateSBCategoriesVisibility() {
          sbCategories.style.display = sbEnabled.checked ? 'block' : 'none';
        }

        sbEnabled.addEventListener('change', updateSBCategoriesVisibility);

        configForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const categories = Array.from(document.querySelectorAll('input[name="sbCategories"]:checked'))
            .map(cb => cb.value);

          const config = {
            cookies: document.getElementById('cookies').value,
            quality: document.getElementById('quality').value,
            sponsorblock: {
              enabled: sbEnabled.checked,
              categories: categories
            },
            dearrow: {
              enabled: document.getElementById('dearrowEnabled').checked
            }
          };

          const configStr = await generateConfig(config);
          const manifestUrl = window.location.origin + '/' + configStr + '/manifest.json';
          const stremioInstallUrl = 'stremio://' + window.location.host + '/' + configStr + '/manifest.json';

          document.getElementById('configValue').textContent = manifestUrl;
          document.getElementById('installLink').href = stremioInstallUrl;
          document.getElementById('configLink').style.display = 'block';
          document.getElementById('copySuccess').style.display = 'none';
        });

        function resetForm() {
          if (confirm('Reset all settings to defaults?')) {
            configForm.reset();
            document.getElementById('configLink').style.display = 'none';
            updateSBCategoriesVisibility();
          }
        }

        async function generateConfig(config) {
          const resp = await fetch('/api/encrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
          const data = await resp.json();
          return data.config;
        }

        function copyConfig() {
          const configValue = document.getElementById('configValue').textContent;
          navigator.clipboard.writeText(configValue).then(() => {
            document.getElementById('copySuccess').style.display = 'block';
            setTimeout(() => {
              document.getElementById('copySuccess').style.display = 'none';
            }, 2000);
          });
        }

        loadConfig();
      </script>

      <div style="text-align: center; padding: 40px 20px; font-size: 13px; color: #505068; border-top: 1px solid rgba(255, 255, 255, 0.04);">
        <a href="https://github.com/cat5edopeHA/tubiopp" style="color: #667eea; text-decoration: none;">GitHub</a>
        <br><span style="margin-top: 8px; display: inline-block; opacity: 0.6;">vibe coded with love &hearts;</span>
      </div>
    </body>
    </html>
  `);
});

/**
 * GET /:config/configure - Stremio's configure button sends users here
 * Redirect to /configure so the form loads correctly
 */
router.get('/:config/configure', (req, res) => {
  res.redirect('/configure');
});

export default router;
