// Live: the device is reached by hostname and by IP address with the TLS trust the
// README documents; its certificate and Node's transport failure classes are
// recorded in the run log (prefix `[reach]`) for the REQ findings.
import { X509Certificate } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { type DetailedPeerCertificate, connect, rootCertificates } from 'node:tls';
import { expect, it } from 'vitest';
import { HemClient, HemUnreachableError } from '../../src/index.js';
import type { FetchFunction } from '../../src/transport/transport.js';
import { describeDevice, deviceClient, deviceFetch, requireDevice } from '../support/integration-env.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[reach] ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`);
}

function describeError(error: unknown): unknown {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: unknown; message?: unknown; name?: unknown } | undefined;
  return { name: error.name, message: error.message, cause: cause === undefined ? undefined : { name: cause.name, code: cause.code, message: cause.message } };
}

/** A `fetch` that logs every response body it sees, for the record. */
function recording(inner: FetchFunction): FetchFunction {
  return async (input, init) => {
    const response = await inner(input, init);
    log(`${init.method ?? 'GET'} ${new URL(input).pathname} → ${response.status}`, await response.clone().text());
    return response;
  };
}

interface Certificate {
  subject: unknown;
  issuer: unknown;
  validFrom: string;
  validTo: string;
  /** Subjects of the chain as sent, leaf first. */
  chain: unknown[];
}

/** Read the certificate chain over a plain TLS handshake. Verification is off here because this only reads. */
function peerCertificate(host: string, servername: string): Promise<Certificate> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername, rejectUnauthorized: false }, () => {
      const leaf = socket.getPeerCertificate(true);
      const chain: unknown[] = [];
      for (let cert: DetailedPeerCertificate | undefined = leaf; cert !== undefined; cert = cert.issuerCertificate === cert ? undefined : cert.issuerCertificate) {
        chain.push(cert.subject);
      }
      socket.end();
      resolve({ subject: leaf.subject, issuer: leaf.issuer, validFrom: leaf.valid_from, validTo: leaf.valid_to, chain });
    });
    socket.on('error', reject);
  });
}

describeDevice('reaching the device', () => {
  // verifies: REQ-NET-002, REQ-SYS-001, REQ-SYS-002
  it('answers status and version by hostname, with the default trust', async () => {
    const env = requireDevice();
    const client = deviceClient({ fetch: recording(deviceFetch(env)) });
    const status = await client.system.status();
    log('status', status);
    expect(status.initialised).toBe(true);
    expect(status.uptime).toBeTypeOf('number');

    const version = await client.system.version();
    log('version', { ...version, fwk: `${version.fwk.length} bytes`, fws: `${version.fws.length} bytes` });
    expect(version.fwv).toContain('1.2.2');
    expect(version.hwv).toBeTypeOf('string');
  });

  // verifies: REQ-NET-002, REQ-NET-001, REQ-NET-012
  it('answers by IP address through a fetch that checks the certificate against the hostname', async () => {
    const env = requireDevice();
    const host = new URL(env.url).hostname;
    const ip = isIP(host) ? host : (await lookup(host)).address;
    log('ip address', ip);
    const byIp = deviceClient({ url: `https://${ip}`, fetch: deviceFetch(env, isIP(host) ? {} : { servername: host }) });
    expect((await byIp.system.status()).initialised).toBe(true);
  });

  // verifies: REQ-NET-012, REQ-NET-001
  it('presents a certificate that is recorded; a fetch with an explicit CA list reaches it, one with a wrong anchor does not', async () => {
    const env = requireDevice();
    const host = new URL(env.url).hostname;
    const cert = await peerCertificate(host, host);
    log('certificate', cert);
    expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());

    // The README's CA method with Node's bundled roots as the explicit list.
    const explicit = deviceClient({ fetch: deviceFetch(env, { ca: rootCertificates }) });
    expect((await explicit.system.status()).initialised).toBe(true);

    // The same method with a single root from another organisation, which cannot have issued the chain.
    const issuerOrganisation = (cert.issuer as { O?: string }).O ?? '';
    const unrelated = rootCertificates.find((pem) => !new X509Certificate(pem).subject.includes(`O=${issuerOrganisation}`));
    expect(unrelated).toBeDefined();
    const wrong = deviceClient({ fetch: deviceFetch(env, { ca: [unrelated as string] }) });
    const error = await wrong.system.status().catch((e: unknown) => e);
    log('wrong trust anchor', describeError(error));
    expect(error).toBeInstanceOf(HemUnreachableError);
  });

  // verifies: REQ-NET-006
  it('reports a name that does not resolve as HemUnreachableError', async () => {
    const env = requireDevice();
    const client = new HemClient({ url: 'https://no-such-host.invalid', fetch: deviceFetch(env) });
    const error = await client.system.status().catch((e: unknown) => e);
    log('unresolvable name', describeError(error));
    expect(error).toBeInstanceOf(HemUnreachableError);
  });

  // ARCHITECTURE.md §11 risk 3: the device closes TCP after every response.
  it('answers ten consecutive calls through one client', async () => {
    const client = deviceClient();
    const started = Date.now();
    for (let i = 0; i < 10; i += 1) expect((await client.system.status()).initialised).toBe(true);
    log('ten status calls, ms', Date.now() - started);
  });
});
