import { render, screen, userEvent } from '@testing-library/react-native';
import type { Account } from '@/account';
import type { Db } from '@/db/client';
import { recordBackup } from '@/db/repo';
import { addDays, todayISO } from '@/domain';
import { router, seedVehicle, setupScreen } from '@/test-utils/screens';
import { BackupReminder } from '../BackupReminder';

jest.mock('expo-router', () => require('@/test-utils/screens').expoRouterMock);
jest.mock('drizzle-orm/expo-sqlite', () => require('@/test-utils/screens').liveQueryMock);
jest.mock('@/db/provider', () => require('@/test-utils/screens').providerMock);
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));
let mockAccount: Account = { status: 'signed-out' };
jest.mock('@/account', () => ({ useAccount: () => mockAccount }));

const NEVER = 'Você ainda não fez nenhum backup. Se perder o celular, perde o histórico.';
// The car is added today; "today" on the dashboard moves forward instead.
const later = (days: number) => addDays(todayISO(), days);
let db: Db;

beforeEach(async () => {
  db = await setupScreen();
  mockAccount = { status: 'signed-out' };
  await seedVehicle(db);
});

test('a month after adding the car, without a backup, it asks for one', async () => {
  await render(<BackupReminder today={later(30)} />);
  expect(screen.queryByText(NEVER)).toBeNull();

  await render(<BackupReminder today={later(31)} />);
  expect(screen.getByText(NEVER)).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Fazer backup' }));
  expect(router.push).toHaveBeenCalledWith('/backup');
});

test('an old backup brings it back, counted in months', async () => {
  await recordBackup(db, todayISO());
  await render(<BackupReminder today={later(90)} />);
  expect(screen.queryByText(/backup/)).toBeNull();

  await render(<BackupReminder today={later(125)} />);
  expect(
    screen.getByText('Seu último backup foi há 4 meses. Se perder o celular, perde o histórico.'),
  ).toBeOnTheScreen();
});

test('"Agora não" hides it for 30 days', async () => {
  const view = await render(<BackupReminder today={later(31)} />);
  await userEvent.setup().press(screen.getByRole('button', { name: 'Agora não' }));
  // The test's live query reads on render only.
  await view.rerender(<BackupReminder today={later(31)} />);
  expect(screen.queryByText(NEVER)).toBeNull();

  await view.rerender(<BackupReminder today={later(60)} />);
  expect(screen.queryByText(NEVER)).toBeNull();
  await view.rerender(<BackupReminder today={later(61)} />);
  expect(screen.getByText(NEVER)).toBeOnTheScreen();
});

test('with an account, or while it loads, it never shows', async () => {
  for (const account of [
    { status: 'signed-in', email: 'ana@example.com' },
    { status: 'loading' },
  ] as Account[]) {
    mockAccount = account;
    await render(<BackupReminder today={later(400)} />);
    expect(screen.queryByText(NEVER)).toBeNull();
  }
});
