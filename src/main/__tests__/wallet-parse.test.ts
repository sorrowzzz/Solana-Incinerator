import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { parseSecret, parseWalletsText, validatePubkey } from '../wallet-parse';

/**
 * Tests use freshly-generated, never-funded ed25519 keypairs created at
 * runtime. Nothing in this file is a real or recoverable secret.
 */
function freshSecretAsBase58(): { secretB58: string; pubkey: string } {
  const kp = Keypair.generate();
  return { secretB58: bs58.encode(kp.secretKey), pubkey: kp.publicKey.toBase58() };
}

function freshSecretAsJsonArray(): { secretJson: string; pubkey: string } {
  const kp = Keypair.generate();
  return { secretJson: JSON.stringify(Array.from(kp.secretKey)), pubkey: kp.publicKey.toBase58() };
}

describe('parseSecret', () => {
  it('accepts a valid base58 secret', () => {
    const { secretB58, pubkey } = freshSecretAsBase58();
    const r = parseSecret(secretB58);
    expect(r.ok).toBe(true);
    expect(r.format).toBe('base58');
    expect(r.pubkey).toBe(pubkey);
  });

  it('accepts a valid JSON byte-array secret', () => {
    const { secretJson, pubkey } = freshSecretAsJsonArray();
    const r = parseSecret(secretJson);
    expect(r.ok).toBe(true);
    expect(r.format).toBe('json-array');
    expect(r.pubkey).toBe(pubkey);
  });

  it('strips an inline comment from base58 input', () => {
    const { secretB58, pubkey } = freshSecretAsBase58();
    const r = parseSecret(`${secretB58}   # main wallet`);
    expect(r.ok).toBe(true);
    expect(r.pubkey).toBe(pubkey);
  });

  it('rejects empty input', () => {
    expect(parseSecret('').ok).toBe(false);
    expect(parseSecret('   ').ok).toBe(false);
  });

  it('rejects an invalid base58 string', () => {
    expect(parseSecret('not_base58_at_all_!!!').ok).toBe(false);
  });

  it('rejects a base58 string with the wrong byte length', () => {
    const tooShort = bs58.encode(new Uint8Array(32));
    const r = parseSecret(tooShort);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/64-byte/);
  });

  it('rejects a JSON array with the wrong length', () => {
    const r = parseSecret(JSON.stringify(new Array(32).fill(1)));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/64-element/);
  });

  it('rejects a JSON array with non-byte values', () => {
    const arr = new Array(64).fill(1);
    arr[5] = 999;
    const r = parseSecret(JSON.stringify(arr));
    expect(r.ok).toBe(false);
  });
});

describe('parseWalletsText', () => {
  it('parses multiple wallets, skips comments and blank lines', () => {
    const a = freshSecretAsBase58();
    const b = freshSecretAsJsonArray();
    const text = [
      '# This is a comment line',
      '',
      `${a.secretB58}  # wallet a`,
      '   ',
      b.secretJson,
      '# trailing comment'
    ].join('\n');

    const result = parseWalletsText(text);
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({ ok: true, pubkey: a.pubkey, format: 'base58' });
    expect(result[1]).toMatchObject({ ok: true, pubkey: b.pubkey, format: 'json-array' });
  });

  it('records errored lines with their original line number', () => {
    const a = freshSecretAsBase58();
    const text = ['', a.secretB58, 'garbage_value_here'].join('\n');
    const result = parseWalletsText(text);
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({ ok: true, line: 2, pubkey: a.pubkey });
    expect(result[1]).toMatchObject({ ok: false, line: 3 });
  });
});

describe('validatePubkey', () => {
  it('accepts a valid Solana base58 pubkey', () => {
    const kp = Keypair.generate();
    const r = validatePubkey(kp.publicKey.toBase58());
    expect(r.ok).toBe(true);
    expect(r.pubkey).toBe(kp.publicKey.toBase58());
  });

  it('rejects empty input', () => {
    expect(validatePubkey('').ok).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(validatePubkey('not-a-pubkey').ok).toBe(false);
  });
});
