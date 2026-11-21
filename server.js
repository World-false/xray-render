const { spawn, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const PORT = process.env.PORT || '10000';
const UUID = process.env.UUID || '';
const WS_PATH = process.env.WS_PATH || '/ws';

if (!UUID) {
  console.error('UUID env required');
  process.exit(1);
}

async function downloadXray() {
  const xrayPath = '/tmp/xray';
  if (fs.existsSync(xrayPath)) return xrayPath;
  // Get latest tag
  let tag = 'v1.8.24';
  try {
    const latest = await new Promise((resolve, reject) => {
      https.get('https://api.github.com/repos/XTLS/Xray-core/releases/latest', { headers: { 'User-Agent': 'xray-render' } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      }).on('error', reject);
    });
    const m = JSON.parse(latest).tag_name;
    if (m) tag = m;
  } catch (e) {
    console.log('Use fallback tag', tag, e.message);
  }
  console.log('Downloading Xray', tag);
  execSync(`cd /tmp && curl -L -o Xray-linux-64.zip https://github.com/XTLS/Xray-core/releases/download/${tag}/Xray-linux-64.zip && unzip -o Xray-linux-64.zip xray && chmod +x xray`, { stdio: 'inherit' });
  return xrayPath;
}

(async () => {
  const xray = await downloadXray();
  const config = {
    log: { loglevel: 'warning' },
    inbounds: [{
      port: parseInt(PORT, 10),
      protocol: 'vless',
      settings: { clients: [{ id: UUID, flow: '' }], decryption: 'none' },
      streamSettings: { network: 'ws', wsSettings: { path: WS_PATH } }
    }],
    outbounds: [{ protocol: 'freedom', tag: 'direct' }]
  };
  fs.writeFileSync('/tmp/config.json', JSON.stringify(config));
  console.log('Starting xray on port', PORT, 'ws path', WS_PATH);
  const proc = spawn(xray, ['-c', '/tmp/config.json'], { stdio: 'inherit' });
  proc.on('exit', (code) => {
    console.log('xray exited', code);
    process.exit(code || 1);
  });
})();
