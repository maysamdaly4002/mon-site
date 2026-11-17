/**
 * Sorties réseau contrôlées pour les modules (`net:outbound`, `net:ftp`).
 * Anti-SSRF : pas de localhost, IPs privées, metadata cloud, ni ports sensibles.
 */
import dns from 'dns/promises';
import net from 'net';
import { Client } from 'basic-ftp';

const BLOCKED_PORTS = new Set([22, 23, 25, 445, 3389, 5432, 6379, 11211, 27017]);

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return (
      v === '::1' ||
      v.startsWith('fc') ||
      v.startsWith('fd') ||
      v.startsWith('fe80') ||
      v === '::' ||
      v.startsWith('::ffff:127.') ||
      v.startsWith('::ffff:10.') ||
      v.startsWith('::ffff:192.168.') ||
      /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(v)
    );
  }
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return true;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0 || a === 100) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

export async function assertSafeOutboundUrl(raw: string | URL, opts?: { allowHttp?: boolean }): Promise<URL> {
  let u: URL;
  try {
    u = typeof raw === 'string' ? new URL(raw) : raw;
  } catch {
    throw new Error('Adresse invalide');
  }
  const allowHttp = opts?.allowHttp !== false;
  if (u.protocol === 'https:') {
    /* ok */
  } else if (u.protocol === 'http:' && allowHttp) {
    /* ok — WordPress legacy */
  } else {
    throw new Error('Seules les adresses http(s) publiques sont autorisées');
  }
  if (u.username || u.password) throw new Error('Identifiants dans l’URL interdits');
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Hôte local interdit');
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new Error('Adresse IP privée interdite');
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  if (BLOCKED_PORTS.has(port) || port < 1 || port > 65535) throw new Error('Port non autorisé');

  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Impossible de résoudre ${host}`);
  }
  if (!records.length) throw new Error(`Hôte introuvable : ${host}`);
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('La destination résout vers un réseau privé (bloqué)');
  }
  return u;
}

/** Fetch avec redirections limitées, chaque hop re-validé (anti-SSRF). */
export async function outboundFetch(url: string, init?: RequestInit, maxRedirects = 3): Promise<Response> {
  let current = await assertSafeOutboundUrl(url);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, {
      ...init,
      redirect: 'manual',
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc || i === maxRedirects) throw new Error('Trop de redirections');
      current = await assertSafeOutboundUrl(new URL(loc, current));
      continue;
    }
    return res;
  }
  throw new Error('Trop de redirections');
}

function assertFtpHost(host: string) {
  const h = host.trim().toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local')) throw new Error('Hôte FTP interdit');
  if (net.isIP(h) && isPrivateIp(h)) throw new Error('IP FTP privée interdite');
  return h;
}

export async function ftpList(opts: {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
  path?: string;
}): Promise<string[]> {
  const host = assertFtpHost(opts.host);
  if (net.isIP(host)) {
    /* already checked */
  } else {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) if (isPrivateIp(r.address)) throw new Error('FTP vers réseau privé bloqué');
  }
  const client = new Client(30_000);
  try {
    await client.access({
      host,
      port: opts.port || (opts.secure ? 990 : 21),
      user: String(opts.user || '').slice(0, 120),
      password: String(opts.password || '').slice(0, 200),
      secure: opts.secure ? 'implicit' : false,
    });
    const list = await client.list(opts.path || '/');
    return list.map((f) => f.name).slice(0, 500);
  } finally {
    client.close();
  }
}

export async function ftpReadText(opts: {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
  path: string;
  maxBytes?: number;
}): Promise<string> {
  const host = assertFtpHost(opts.host);
  if (!net.isIP(host)) {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) if (isPrivateIp(r.address)) throw new Error('FTP vers réseau privé bloqué');
  }
  const remote = String(opts.path || '');
  if (!remote.startsWith('/') || remote.includes('..')) throw new Error('Chemin FTP invalide');
  const max = Math.min(Math.max(opts.maxBytes || 2_000_000, 1024), 5_000_000);
  const client = new Client(30_000);
  try {
    await client.access({
      host,
      port: opts.port || (opts.secure ? 990 : 21),
      user: String(opts.user || '').slice(0, 120),
      password: String(opts.password || '').slice(0, 200),
      secure: opts.secure ? 'implicit' : false,
    });
    const chunks: Buffer[] = [];
    let size = 0;
    const { Writable } = await import('stream');
    const writable = new Writable({
      write(chunk, _enc, cb) {
        size += chunk.length;
        if (size > max) {
          cb(new Error('Fichier FTP trop volumineux'));
          return;
        }
        chunks.push(Buffer.from(chunk));
        cb();
      },
    });
    await client.downloadTo(writable, remote);
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    client.close();
  }
}
