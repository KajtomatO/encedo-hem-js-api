// Live, read-only: the device configuration and the audit log. No key is created
// and nothing is changed. Values that are the owner's data (user, email,
// hostname, ip) are reported by presence only. Findings go to the run log
// (prefix `[cfg]`).
import { expect, it } from 'vitest';
import { type DeviceConfig, type HemClient, HemUnsupportedError } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[cfg] ${label}: ${JSON.stringify(value)}\n`);
}

describeDevice('configuration and audit log on the device', () => {
  const client: HemClient = deviceClient();
  let config: DeviceConfig;

  // verifies: REQ-SYS-008, REQ-API-011
  it('reads the configuration; optional fields and the hardware build are recorded', async () => {
    config = await client.system.config();
    const optional = ['instanceid', 'genuineId', 'storageMode', 'storageDisk0Size', 'storageCapacity'] as const;
    log('config', {
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      devidLength: config.devid.length,
      eidBytes: config.eid.length,
      eidSignBytes: config.eidSign.length,
      spkBytes: config.spk.length,
      nonceBytes: config.nonce.length,
      hasUser: config.user.length > 0,
      hasEmail: config.email.length > 0,
      hasHostname: config.hostname.length > 0,
      ipIsCidr: /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(config.ip),
      origin: config.origin,
      dnsd: config.dnsd,
      trustedTime: config.trustedTime,
      trustedBackend: config.trustedBackend,
      allowKeysearch: config.allowKeysearch,
      ctx: config.ctx,
      hsts: config.hsts,
      dosProtectionMode: config.dosProtectionMode,
      optionalPresent: optional.filter((name) => config[name] !== undefined),
      storageMode: config.storageMode ?? null,
      storageDisk0Size: config.storageDisk0Size ?? null,
      storageCapacity: config.storageCapacity ?? null,
    });
    expect(config.eid).toHaveLength(32);
    expect(config.eidSign).toHaveLength(32);
    expect(config.spk).toHaveLength(32);
    const status = await client.system.status();
    const version = await client.system.version();
    log('hardware build', { hwv: version.hwv, fwv: version.fwv, statusStorage: status.storage ?? null, sdCsd: version.sdCsd !== undefined, uis: version.uis !== undefined });
  }, 60_000);

  // verifies: REQ-SYS-009
  it('reads the logger key: lengths recorded', async () => {
    const material = await client.logger.key();
    log('logger key', { keyBytes: material.key.length, nonceBytes: material.nonce.length, nonceSignedBytes: material.nonceSigned.length });
    expect(material.key).toHaveLength(32);
    expect(material.nonce).toHaveLength(32);
    expect(material.nonceSigned).toHaveLength(64);
    const again = await client.logger.key();
    log('logger key: second call', { sameKey: material.key.every((b, i) => b === again.key[i]), sameNonce: material.nonce.every((b, i) => b === again.nonce[i]) });
  }, 60_000);

  // verifies: REQ-SYS-010, REQ-SYS-011, REQ-API-011
  it('lists the log files and downloads the newest one; content type and a format sample recorded', async () => {
    const listing = await client.logger.list().then(
      (page) => ({ ok: true as const, page }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    if (!listing.ok) {
      log('logger list', { error: (listing.error as Error).name, status: (listing.error as { status?: number }).status, message: (listing.error as Error).message });
      expect(listing.error).toBeInstanceOf(HemUnsupportedError);
      return;
    }
    const { page } = listing;
    log('logger list', { total: page.total, idsOnPage: page.ids.length, first: page.ids[0], last: page.ids.at(-1) });
    expect(page.ids.every((id) => /^[0-9a-f]{8}$/.test(id))).toBe(true);
    if (page.total > page.ids.length) {
      const next = await client.logger.list({ offset: page.ids.length });
      log('logger list: second page', { offset: page.ids.length, idsOnPage: next.ids.length, total: next.total });
    }
    const sorted = [...page.ids].sort();
    const newest = sorted.at(-1);
    if (newest === undefined) {
      log('logger download', 'no log file to download');
      return;
    }
    // The newest file is the one of the current boot, still being written: the reference says 406.
    const current = await client.logger.download(newest).then(
      (f) => ({ downloaded: true, bytes: f.bytes.length }),
      (error: unknown) => ({ downloaded: false, error: `${(error as Error).name} ${(error as { status?: number }).status ?? ''}` }),
    );
    log('logger download of the newest (current boot) file', { id: newest, ...current });
    const previous = sorted.at(-2);
    if (previous === undefined) {
      log('logger download', 'only the current file exists');
      return;
    }
    const file = await client.logger.download(previous);
    const text = file.text();
    const lines = text.split('\n');
    const sample = lines.slice(0, 3).map((line) => line.replace(/[0-9a-fA-F]{32,}/g, (h) => `<${h.length} hex>`));
    log('logger download', { id: file.id, bytes: file.bytes.length, contentType: file.contentType ?? null, lines: lines.length, fieldsPerLine: lines[0]?.split('|').length, sample });
    expect(file.bytes.length).toBeGreaterThan(0);
    const unknown = await client.logger.download('00000000').then(
      () => 'downloaded',
      (error: unknown) => `${(error as Error).name} ${(error as { status?: number }).status ?? ''}`,
    );
    log('logger download of an unknown id', unknown);
  }, 120_000);
});
