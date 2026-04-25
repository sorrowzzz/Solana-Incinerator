import { Keypair, PublicKey } from '@solana/web3.js';
import * as bs58Module from 'bs58';
import type { ParsedWallet } from '@shared/types';

// Defensive interop: bs58 v5 is dual ESM/CJS, but some bundlers wrap the
// default export in `{ default: ... }`. Prefer the namespace's `decode`
// when present, otherwise fall back to `.default.decode`.
interface Bs58Like { decode(s: string): Uint8Array; encode(b: Uint8Array): string }
const bs58: Bs58Like =
  typeof (bs58Module as unknown as Bs58Like).decode === 'function'
    ? (bs58Module as unknown as Bs58Like)
    : ((bs58Module as unknown as { default: Bs58Like }).default);

export interface ParseSecretResult {
  ok: boolean;
  keypair?: Keypair;
  pubkey?: string;
  format?: 'base58' | 'json-array';
  reason?: string;
}

/**
 * Decode a single secret-key string. Accepts:
 *   - base58 (Phantom export, 64-byte secret encoded as ~87–88 base58 chars)
 *   - JSON byte-array `[1,2,...,64]` (solana-keygen / Solana CLI format)
 *
 * Trims whitespace; strips an inline `# comment` suffix. Empty input is an
 * error so callers can distinguish "blank line" upstream.
 */
export function parseSecret(rawInput: string): ParseSecretResult {
  // Strip surrounding whitespace including unicode whitespace and zero-width
  // characters that some clipboards inject during paste.
  const cleaned = stripInlineComment(rawInput)
    .replace(/[​-‏﻿]/g, '')
    .trim();
  if (cleaned.length === 0) return { ok: false, reason: 'empty input' };

  if (cleaned.startsWith('[')) {
    return parseJsonArraySecret(cleaned);
  }
  // Detect a likely seed phrase (multiple words separated by spaces).
  if (/\s/.test(cleaned)) {
    const words = cleaned.split(/\s+/);
    if (words.length === 12 || words.length === 24) {
      return {
        ok: false,
        reason: `looks like a ${words.length}-word recovery phrase. Paste the Phantom Private Key (a single long base58 string), not the recovery phrase.`
      };
    }
    return { ok: false, reason: 'whitespace inside key — paste a single base58 string with no spaces' };
  }
  return parseBase58Secret(cleaned);
}

function parseBase58Secret(value: string): ParseSecretResult {
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(value);
  } catch (e) {
    return {
      ok: false,
      reason: `base58 decode failed: ${(e as Error).message}`
    };
  }
  if (bytes.length === 32) {
    return {
      ok: false,
      reason: 'this is a 32-byte seed, not a 64-byte expanded secret. Phantom export is 64 bytes (~88 base58 chars). Make sure you copied the full Private Key.'
    };
  }
  if (bytes.length !== 64) {
    return { ok: false, reason: `expected 64-byte secret, got ${bytes.length} bytes (${value.length} base58 chars)` };
  }
  try {
    const kp = Keypair.fromSecretKey(bytes);
    return { ok: true, keypair: kp, pubkey: kp.publicKey.toBase58(), format: 'base58' };
  } catch (e) {
    return { ok: false, reason: `not a valid keypair: ${(e as Error).message}` };
  }
}

function parseJsonArraySecret(value: string): ParseSecretResult {
  let arr: unknown;
  try {
    arr = JSON.parse(value);
  } catch {
    return { ok: false, reason: 'invalid JSON array' };
  }
  if (!Array.isArray(arr)) return { ok: false, reason: 'JSON value is not an array' };
  if (arr.length !== 64) {
    return { ok: false, reason: `expected 64-element byte array, got ${arr.length}` };
  }
  for (const v of arr) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 255) {
      return { ok: false, reason: 'JSON array contains non-byte values' };
    }
  }
  try {
    const kp = Keypair.fromSecretKey(Uint8Array.from(arr as number[]));
    return { ok: true, keypair: kp, pubkey: kp.publicKey.toBase58(), format: 'json-array' };
  } catch (e) {
    return { ok: false, reason: `not a valid keypair: ${(e as Error).message}` };
  }
}

function stripInlineComment(line: string): string {
  const i = line.indexOf('#');
  if (i === -1) return line;
  // Don't strip inside JSON arrays — # outside brackets only.
  if (line.trimStart().startsWith('[')) return line;
  return line.slice(0, i);
}

/**
 * Parse the entire wallets-file text. Returns one ParsedWallet per
 * meaningful line. Blank lines and full-line comments are skipped silently.
 *
 * Note: this returns *only public keys* in the result, not the secret bytes.
 * Callers that need the keypairs should call {@link parseWalletsTextWithKeys}.
 */
export function parseWalletsText(text: string): ParsedWallet[] {
  const out: ParsedWallet[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripInlineComment(line).trim();
    if (stripped.length === 0) continue;

    const parsed = parseSecret(line);
    if (parsed.ok && parsed.pubkey && parsed.format) {
      out.push({ line: i + 1, pubkey: parsed.pubkey, format: parsed.format, ok: true });
    } else {
      out.push({
        line: i + 1,
        pubkey: '',
        format: 'base58',
        ok: false,
        error: parsed.reason ?? 'unknown error'
      });
    }
  }
  return out;
}

export interface ParsedWalletWithKey extends ParsedWallet {
  keypair?: Keypair;
}

/**
 * Like {@link parseWalletsText} but also retains the actual Keypair for each
 * successfully-parsed line. Use only inside the main process; never send
 * Keypair instances over IPC.
 */
export function parseWalletsTextWithKeys(text: string): ParsedWalletWithKey[] {
  const out: ParsedWalletWithKey[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripInlineComment(line).trim();
    if (stripped.length === 0) continue;

    const parsed = parseSecret(line);
    if (parsed.ok && parsed.keypair && parsed.format) {
      out.push({
        line: i + 1,
        pubkey: parsed.keypair.publicKey.toBase58(),
        format: parsed.format,
        ok: true,
        keypair: parsed.keypair
      });
    } else {
      out.push({
        line: i + 1,
        pubkey: '',
        format: 'base58',
        ok: false,
        error: parsed.reason ?? 'unknown error'
      });
    }
  }
  return out;
}

/**
 * Validate a Solana base58 public key. Returns the canonical PublicKey form
 * on success.
 */
export function validatePubkey(value: string): { ok: boolean; pubkey?: string; reason?: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  try {
    const pk = new PublicKey(trimmed);
    return { ok: true, pubkey: pk.toBase58() };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
