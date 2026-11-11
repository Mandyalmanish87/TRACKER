/**
 * Device-local encrypted storage for Bloom. The ciphertext is deliberately kept
 * outside AppStateData so ordinary cloud sync, backups, and admin tooling never
 * receive menstrual wellness records.
 */
export const BLOOM_STORAGE_KEY = 'tracker_bloom_vault_v1';
const VAULT_FORMAT = 'tracker-bloom-vault-v1';
const PBKDF2_ITERATIONS = 310_000;

export type BloomFlow = 'spotting' | 'light' | 'medium' | 'heavy';

export interface BloomPeriod {
  id: string;
  startDate: string;
  endDate?: string;
  flow?: BloomFlow;
  color?: string;
  clots?: string;
  note?: string;
}

export interface BloomCheckIn {
  id: string;
  date: string;
  mood?: string;
  energy?: number;
  symptoms: string[];
  note?: string;
  stress?: number;
  motivation?: number;
  moodIntensity?: number;
  symptomSeverity?: Record<string, number>;
  gratitude?: string;
}

export interface BloomLifestyleEntry {
  id: string; date: string; sleepHours?: number; waterMl?: number; activity?: string;
  appetite?: string; caffeine?: string; medication?: string; stress?: string; note?: string;
}
export interface BloomJournalEntry { id: string; date: string; kind: string; text: string }
export interface BloomPlanEntry { id: string; date: string; text: string; done: boolean }

export interface BloomVaultData {
  [key: string]: unknown;
  format: 'tracker-bloom-data-v1';
  periods: BloomPeriod[];
  checkIns: BloomCheckIn[];
  lifestyle?: BloomLifestyleEntry[];
  journal?: BloomJournalEntry[];
  plans?: BloomPlanEntry[];
  profile?: { displayName?: string };
  preferences?: Record<string, unknown>;
  reminders?: { enabled: boolean; time?: string; discreet: boolean };
}

export interface BloomVaultEnvelope {
  format: typeof VAULT_FORMAT;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
}

export const EMPTY_BLOOM_DATA: BloomVaultData = {
  format: 'tracker-bloom-data-v1',
  periods: [],
  checkIns: [],
  lifestyle: [], journal: [], plans: [], preferences: {}, reminders: { enabled: false, discreet: true },
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const deriveKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  if (!globalThis.crypto?.subtle) throw new Error('Secure local encryption is unavailable in this browser.');
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const readBloomEnvelope = (): BloomVaultEnvelope | null => {
  const raw = localStorage.getItem(BLOOM_STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (
    parsed?.format !== VAULT_FORMAT ||
    typeof parsed.salt !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) throw new Error('Bloom vault file is damaged or uses an unsupported format.');
  return parsed as BloomVaultEnvelope;
};

export const createBloomEnvelope = async (data: BloomVaultData, passphrase: string): Promise<BloomVaultEnvelope> => {
  if (passphrase.length < 10) throw new Error('Use a passphrase with at least 10 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    format: VAULT_FORMAT,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString(),
  };
};

export const unlockBloomEnvelope = async (envelope: BloomVaultEnvelope, passphrase: string): Promise<BloomVaultData> => {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const key = await deriveKey(passphrase, salt);
  let cleartext: ArrayBuffer;
  try {
    cleartext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      base64ToBytes(envelope.ciphertext) as unknown as BufferSource
    );
  } catch {
    throw new Error('That passphrase did not unlock this Bloom vault.');
  }
  const parsed = JSON.parse(new TextDecoder().decode(cleartext));
  if (parsed?.format !== 'tracker-bloom-data-v1' || !Array.isArray(parsed.periods) || !Array.isArray(parsed.checkIns)) {
    throw new Error('Bloom vault data could not be read safely.');
  }
  return parsed as BloomVaultData;
};

export const persistBloomEnvelope = (envelope: BloomVaultEnvelope): void => {
  localStorage.setItem(BLOOM_STORAGE_KEY, JSON.stringify(envelope));
};

export const removeBloomEnvelope = (): void => {
  localStorage.removeItem(BLOOM_STORAGE_KEY);
};

export const parseBloomBackup = (value: string): BloomVaultEnvelope => {
  const parsed = JSON.parse(value);
  if (
    parsed?.format !== VAULT_FORMAT ||
    typeof parsed.salt !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) throw new Error('This file is not a supported encrypted Bloom backup.');
  return parsed as BloomVaultEnvelope;
};
