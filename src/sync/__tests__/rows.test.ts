import { AESEncryptionKey, aesEncryptAsync } from 'expo-crypto';
import * as localSync from '@/db/sync';
import { DATA_SCHEMA, type SyncRow } from '@/db/sync';
import { fromByteaHex, isoMs, toByteaHex } from '../remote';
import { openRow, sealRow } from '../rows';

jest.mock('expo-crypto', () => require('@/test-utils/crypto').expoCryptoMock());

const ID = '0199f0a0-0000-7000-8000-000000000001';
const row: SyncRow = {
  table: 'vehicles',
  id: ID,
  updatedAt: '2026-10-01T09:00:00.000Z',
  deletedAt: null,
  row: {
    id: ID,
    nickname: 'Fusca — ação 🚗',
    updatedAt: '2026-10-01T09:00:00.000Z',
    deletedAt: null,
  },
};

let key: AESEncryptionKey;
beforeEach(async () => {
  key = await AESEncryptionKey.generate();
});

test('seal then open gives the row back, accents and emoji included', async () => {
  const sealed = await sealRow(key, row);
  expect(sealed).toMatchObject({ table: 'vehicles', id: ID, keyVersion: 1, deletedAt: null });
  expect(sealed.nonce).toHaveLength(12);
  expect(await openRow(key, sealed)).toEqual({ ...row, schema: DATA_SCHEMA });
});

test('the envelope says which data schema sealed it', async () => {
  expect(DATA_SCHEMA).toBeGreaterThan(0);
  const newerApp = jest.replaceProperty(localSync, 'DATA_SCHEMA', DATA_SCHEMA + 1);
  const sealed = await sealRow(key, row);
  newerApp.restore();
  expect((await openRow(key, sealed))?.schema).toBe(DATA_SCHEMA + 1);
});

test('rows sealed before the schema was recorded open as schema 0; a bad one is refused', async () => {
  const sealedWith = async (envelope: object) => {
    const text = JSON.stringify(envelope);
    const sealed = await aesEncryptAsync(
      Uint8Array.from(text, (c) => c.charCodeAt(0)),
      key,
      {
        additionalData: Uint8Array.from(`garagem/row/v1:vehicles:${ID}`, (c) => c.charCodeAt(0)),
      },
    );
    const good = await sealRow(key, row);
    return {
      ...good,
      ciphertext: await sealed.ciphertext({ includeTag: true }),
      nonce: await sealed.iv(),
    };
  };
  const plain = { ...row.row, nickname: 'Fusca' };
  expect((await openRow(key, await sealedWith({ v: 1, row: plain })))?.schema).toBe(0);
  expect(await openRow(key, await sealedWith({ v: 1, schema: '9', row: plain }))).toBeNull();
});

test('the server cannot pass a row off as another table or id', async () => {
  const sealed = await sealRow(key, row);
  expect(await openRow(key, { ...sealed, table: 'maintenance_items' })).toBeNull();
  expect(await openRow(key, { ...sealed, id: '0199f0a0-0000-7000-8000-000000000002' })).toBeNull();
});

test('a row whose readable time disagrees with the sealed one is refused', async () => {
  const sealed = await sealRow(key, row);
  expect(await openRow(key, { ...sealed, updatedAt: '2030-01-01T00:00:00.000Z' })).toBeNull();
});

test('unknown tables (a newer app) are ignored', async () => {
  const sealed = await sealRow(key, row);
  expect(await openRow(key, { ...sealed, table: 'attachments' })).toBeNull();
});

test('bytea hex round-trips and matches PostgREST', () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  expect(fromByteaHex(toByteaHex(all))).toEqual(all);
  expect(toByteaHex(Uint8Array.of(0, 15, 255))).toBe('\\x000fff');
  expect(fromByteaHex('\\x000FFF')).toEqual(Uint8Array.of(0, 15, 255));
  expect(() => fromByteaHex('000fff')).toThrow();
  expect(() => fromByteaHex('\\x0')).toThrow();
});

test('server timestamps read back in the app format', () => {
  expect(isoMs('2026-10-20T20:01:17.886+00:00')).toBe('2026-10-20T20:01:17.886Z');
  expect(isoMs('2026-10-20 20:01:17.886+00')).toBe('2026-10-20T20:01:17.886Z');
  expect(isoMs('2026-10-20T17:01:17.8+03:00')).toBe('2026-10-20T14:01:17.800Z');
});
