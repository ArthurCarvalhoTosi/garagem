// Encrypted backup file (.bkp): the way to move data to another phone in v0, since the database and
// photo keys never leave the device. Layout: a one-line ASCII JSON header, "\n", then AES-256-GCM
// sealed data (nonce + ciphertext + tag) whose key comes from the user's password via Argon2id.
// The header is the GCM additional data, so tampering with the KDF parameters fails to open.
import { argon2idAsync } from '@noble/hashes/argon2';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytes,
} from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { readPhoto, writePhoto } from '@/attachments';
import type { Db } from '@/db/client';
import { DATA_SCHEMA as SCHEMA } from '@/db/sync';
import { backupRows, replaceAllData, type BackupRows } from '@/db/repo';
import { ValidationError, type ISODate } from '@/domain';

const FORMAT = 'garagem-backup';
const VERSION = 1;
// OWASP's Argon2id minimum (19 MiB, 2 passes). Pure JS on the phone: a few seconds, once per file.
const KDF = { name: 'argon2id', m: 19456, t: 2, p: 1 } as const;
export const MIN_PASSWORD = 8;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Header = { format: string; version: number; kdf: typeof KDF & { salt: string } };

type Payload = {
  schema: number;
  createdAt: string;
  rows: BackupRows;
  /** Decrypted receipt JPEGs (base64) by the file path their attachment row had. */
  photos: Record<string, string>;
};

export type Backup = Pick<Payload, 'rows' | 'photos'>;

export const BACKUP_ERRORS = {
  notBackup: 'Este arquivo não é um backup do Garagem.',
  wrongPassword: 'Senha errada ou arquivo danificado.',
  newer: 'Este backup foi feito numa versão mais nova do app. Atualize o app e tente de novo.',
} as const;

/** Writes an encrypted backup of everything, photos included, to the cache folder. The caller shares and deletes it. */
export async function createBackupFile(db: Db, password: string, today: ISODate): Promise<File> {
  const rows = backupRows(db);
  const photos: Record<string, string> = {};
  for (const a of rows.attachments) {
    if (a.deletedAt === null) photos[a.filePath] = await readPhoto(a.filePath);
  }
  const payload: Payload = { schema: SCHEMA, createdAt: new Date().toISOString(), rows, photos };

  const salt = getRandomBytes(16);
  const header: Header = {
    format: FORMAT,
    version: VERSION,
    kdf: { ...KDF, salt: toBase64(salt) },
  };
  const headerBytes = ascii(JSON.stringify(header));
  const key = await deriveKey(password, salt, header.kdf);
  const sealed = await aesEncryptAsync(ascii(asciiJson(payload)), key, {
    additionalData: headerBytes,
  });
  const body = await sealed.combined();

  const bytes = new Uint8Array(headerBytes.length + 1 + body.length);
  bytes.set(headerBytes);
  bytes[headerBytes.length] = 0x0a;
  bytes.set(body, headerBytes.length + 1);
  const file = new File(Paths.cache, `Garagem-backup-${today}.bkp`);
  if (file.exists) file.delete();
  await file.write(bytes);
  return file;
}

/** Opens a backup file; throws ValidationError (BACKUP_ERRORS) for anything that isn't a readable backup. */
export async function readBackupFile(uri: string, password: string): Promise<Backup> {
  const source = new File(uri);
  // Far above any real backup (each photo is a few hundred KB); a huge file isn't read whole.
  if (source.size > MAX_FILE_BYTES) throw new ValidationError(BACKUP_ERRORS.notBackup);
  const bytes = await source.bytes();
  // A header longer than this isn't ours; also keeps a big unrelated file from being parsed whole.
  const newline = bytes.subarray(0, 1024).indexOf(0x0a);
  let header: Header | undefined;
  try {
    if (newline > 0) header = JSON.parse(fromAscii(bytes.subarray(0, newline)));
  } catch {
    // Not JSON: handled below like any other file that isn't a backup.
  }
  if (!header || header.format !== FORMAT) throw new ValidationError(BACKUP_ERRORS.notBackup);
  if (header.version > VERSION) throw new ValidationError(BACKUP_ERRORS.newer);
  // The cost runs before GCM can authenticate the header, so a file must not choose it.
  const { kdf } = header;
  if (kdf?.name !== KDF.name || kdf.m !== KDF.m || kdf.t !== KDF.t || kdf.p !== KDF.p)
    throw new ValidationError(BACKUP_ERRORS.notBackup);

  let payload: Payload;
  try {
    const key = await deriveKey(password, fromBase64(header.kdf.salt), header.kdf);
    const plain = await aesDecryptAsync(
      AESSealedData.fromCombined(bytes.subarray(newline + 1)),
      key,
      {
        output: 'bytes',
        additionalData: bytes.subarray(0, newline),
      },
    );
    payload = JSON.parse(fromAscii(plain));
  } catch {
    // GCM can't tell a wrong password from a damaged file.
    throw new ValidationError(BACKUP_ERRORS.wrongPassword);
  }
  if (
    typeof payload?.schema !== 'number' ||
    typeof payload.rows !== 'object' ||
    typeof payload.photos !== 'object'
  ) {
    throw new ValidationError(BACKUP_ERRORS.notBackup);
  }
  if (payload.schema > SCHEMA) throw new ValidationError(BACKUP_ERRORS.newer);
  return { rows: payload.rows, photos: payload.photos };
}

/**
 * Replaces all local data with the backup's. Photos are encrypted again with this phone's key; the
 * old photo files go only after the database switched over, and the new ones go if it didn't.
 */
export async function restoreBackup(db: Db, backup: Backup): Promise<void> {
  const before = backupRows(db).attachments.map((a) => a.filePath);
  const written: string[] = [];
  try {
    const attachments = [];
    for (const a of backup.rows.attachments ?? []) {
      // The file's path is never trusted: the app later deletes files by it (as sync, @/db/sync).
      if (!UUID.test(a.id)) throw new ValidationError(BACKUP_ERRORS.notBackup);
      const photo = Object.hasOwn(backup.photos, a.filePath) ? backup.photos[a.filePath] : null;
      if (a.deletedAt === null && photo) {
        const saved = await writePhoto(photo);
        written.push(saved.filePath);
        attachments.push({ ...a, filePath: saved.filePath, sizeBytes: saved.sizeBytes });
      } else {
        attachments.push({ ...a, filePath: `attachments/${a.id}.bin` });
      }
    }
    await replaceAllData(db, { ...backup.rows, attachments });
  } catch (e) {
    written.forEach(discard);
    throw e;
  }
  before.forEach(discard);
}

function deriveKey(password: string, salt: Uint8Array, kdf: { m: number; t: number; p: number }) {
  // NFC: the same password typed on another keyboard may arrive in a different Unicode form.
  return argon2idAsync(password.normalize('NFC'), salt, {
    m: kdf.m,
    t: kdf.t,
    p: kdf.p,
    dkLen: 32,
  }).then((raw) => AESEncryptionKey.import(raw));
}

function discard(filePath: string) {
  try {
    const f = new File(Paths.document, filePath);
    if (f.exists) f.delete();
  } catch {
    // Best effort: a stray encrypted file is unreadable without its key.
  }
}

// JSON with every non-ASCII character escaped, so bytes and text convert one to one without
// TextDecoder (not in every Hermes build).
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function fromAscii(bytes: Uint8Array): string {
  let s = '';
  // Chunked: String.fromCharCode with millions of arguments overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(fromAscii(bytes));
}

function fromBase64(s: string): Uint8Array {
  return ascii(atob(s));
}
