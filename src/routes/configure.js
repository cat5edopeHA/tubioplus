import express from 'express';
import { encryptConfig, decryptConfig, DEFAULT_CONFIG } from '../config.js';

const router = express.Router();

/**
 * GET / - Show addon info and installation link
 */
router.get('/', (req, res) => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const manifestUrl = `${proto}://${host}/manifest.json`;
  const stremioUrl = `stremio://${host}/manifest.json`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>YouTube for Stremio</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
          text-align: center;
        }

        h1 {
          color: #333;
          margin-bottom: 10px;
          font-size: 28px;
        }

        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }

        .icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
        }

        .info {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          text-align: left;
          font-size: 13px;
          color: #666;
          line-height: 1.6;
        }

        .info h3 {
          color: #333;
          margin-bottom: 10px;
          font-size: 14px;
        }

        .info ul {
          margin-left: 20px;
        }

        .info li {
          margin-bottom: 5px;
        }

        .buttons {
          display: flex;
          gap: 10px;
          flex-direction: column;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        @media (max-width: 600px) {
          .container {
            padding: 30px 20px;
          }

          h1 {
            font-size: 24px;
          }

          .btn {
            padding: 10px 16px;
            font-size: 13px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">▶️</div>
        <h1>YouTube for Stremio</h1>
        <p class="subtitle">Stream YouTube videos directly in Stremio Lite</p>

        <div class="info">
          <h3>Features</h3>
          <ul>
            <li>🎬 Stream YouTube videos in Stremio</li>
            <li>📺 Works on iOS, tvOS, and web</li>
            <li>🔍 Search, trending, subscriptions, history</li>
            <li>⚙️ Configure quality and features</li>
          </ul>
        </div>

        <div class="buttons">
          <a href="${stremioUrl}" class="btn btn-primary">📲 Install in Stremio</a>
          <a href="/configure/configure" class="btn btn-secondary">⚙️ Configure</a>
        </div>

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
 * GET /configure - Show configuration page
 */
router.get('/configure', (req, res) => {
  const defaultConfigStr = encryptConfig(DEFAULT_CONFIG);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Configure YouTube for Stremio</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f5f5f5;
          padding: 20px;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 30px;
        }

        h1 {
          color: #333;
          margin-bottom: 30px;
          font-size: 24px;
          text-align: center;
        }

        .form-section {
          margin-bottom: 30px;
          padding-bottom: 30px;
          border-bottom: 1px solid #eee;
        }

        .form-section:last-child {
          border-bottom: none;
        }

        .form-section h2 {
          color: #555;
          font-size: 16px;
          margin-bottom: 15px;
          font-weight: 600;
        }

        .form-group {
          margin-bottom: 15px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #333;
          font-size: 13px;
          font-weight: 500;
        }

        input[type="text"],
        input[type="number"],
        select,
        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
        }

        textarea {
          min-height: 150px;
          resize: vertical;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        select:focus,
        textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-help {
          font-size: 12px;
          color: #999;
          margin-top: 5px;
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

        .checkbox-item input {
          width: auto;
          margin: 0;
        }

        .checkbox-item label {
          margin: 0;
          display: inline;
        }

        .buttons {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }

        .btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        .config-link {
          margin-top: 30px;
          padding: 15px;
          background: #f0f4ff;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }

        .config-link label {
          margin-bottom: 5px;
        }

        .config-value {
          word-break: break-all;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 11px;
          color: #666;
          background: white;
          padding: 10px;
          border-radius: 4px;
          margin-top: 8px;
          max-height: 100px;
          overflow-y: auto;
        }

        .copy-btn {
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-top: 8px;
        }

        .copy-btn:hover {
          background: #5568d3;
        }

        .success {
          color: #28a745;
          font-size: 12px;
          margin-top: 5px;
        }

        @media (max-width: 600px) {
          .container {
            padding: 20px;
          }

          h1 {
            font-size: 20px;
          }

          .buttons {
            flex-direction: column;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚙️ Configure YouTube for Stremio</h1>

        <form id="configForm">
          <div class="form-section">
            <h2>YouTube Authentication (Optional)</h2>
            <div class="form-group">
              <label for="cookies">Cookies (Netscape Format)</label>
              <textarea id="cookies" name="cookies" placeholder="Paste your YouTube cookies here to access subscriptions, history, and watch later..."></textarea>
              <div class="form-help">Export cookies from your browser using an extension like "Get cookies.txt LOCALLY"</div>
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
            <h2>SponsorBlock (Ad Skipping)</h2>
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="sbEnabled" name="sbEnabled">
                <label for="sbEnabled">Enable SponsorBlock</label>
              </div>
              <div class="form-help">Skip sponsor segments and other content in videos</div>
            </div>

            <div id="sbCategories" style="margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 6px; display: none;">
              <label style="margin-bottom: 10px; display: block; font-weight: 600;">Skip these segment types:</label>
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
                  <label for="sbPreview">Preview/Recap</label>
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
            <h2>DeArrow (Community Titles & Thumbnails)</h2>
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="dearrowEnabled" name="dearrowEnabled">
                <label for="dearrowEnabled">Enable DeArrow</label>
              </div>
              <div class="form-help">Use community-created titles and thumbnails instead of YouTube's clickbait</div>
            </div>
          </div>

          <div class="buttons">
            <button type="submit" class="btn btn-primary">💾 Save & Generate Config</button>
            <button type="button" class="btn btn-secondary" onclick="resetForm()">↺ Reset to Defaults</button>
          </div>
        </form>

        <div id="configLink" class="config-link" style="display: none;">
          <a id="installLink" href="#" class="btn btn-primary" style="display:block;text-align:center;margin-bottom:15px;text-decoration:none;">📲 Install in Stremio</a>
          <label>📋 Your Manifest URL:</label>
          <div class="config-value" id="configValue"></div>
          <button type="button" class="copy-btn" onclick="copyConfig()">📋 Copy URL</button>
          <div id="copySuccess" class="success" style="display: none;">✓ Copied to clipboard!</div>
        </div>
      </div>

      <script>
        const configForm = document.getElementById('configForm');
        const sbEnabled = document.getElementById('sbEnabled');
        const sbCategories = document.getElementById('sbCategories');

        function loadConfig() {
          // Defaults are already set in the HTML
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

          // Generate encrypted config via server
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
          const resp = await fetch('/configure/api/encrypt', {
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

        // Load config on page load
        loadConfig();
      </script>
    </body>
    </html>
  `);
});

export default router;
