const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
const env = { NODE_ENV: 'production' };
for (const line of fs.readFileSync(envPath, 'utf8').split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}
module.exports = {
  apps: [{
    name: 'snapify',
    cwd: '/home/snapify',
    script: 'npx',
    args: 'tsx server.ts',
    interpreter: 'none',
    env,
  }],
};
