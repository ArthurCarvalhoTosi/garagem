import { render, screen, userEvent } from '@testing-library/react-native';
import PickItem from '@/app/pick-item';
import type { Db } from '@/db/client';
import { addDays, todayISO } from '@/domain';
import { params, router, seedVehicle, setupScreen } from '@/test-utils/screens';

jest.mock('expo-router', () => require('@/test-utils/screens').expoRouterMock);
jest.mock('drizzle-orm/expo-sqlite', () => require('@/test-utils/screens').liveQueryMock);
jest.mock('@/db/provider', () => require('@/test-utils/screens').providerMock);
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));

let db: Db;
beforeEach(async () => {
  db = await setupScreen();
});

test('lists the car items worst first and registers the one picked', async () => {
  // 400 days at ~1.000 km/month: oil is past its limit.
  const { vehicleId, oilId } = await seedVehicle(db, addDays(todayISO(), -400));
  params.vehicleId = vehicleId;
  await render(<PickItem />);

  expect(screen.getByRole('header', { name: 'Qual troca você fez?' })).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: /^Troca de óleo e filtro\. Crítico/ }));

  // Replace: the register sheet takes this one's place instead of opening under it on iOS.
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/register', params: { itemId: oilId } });
});

test('offers another maintenance for a job not on the list', async () => {
  const { vehicleId } = await seedVehicle(db);
  params.vehicleId = vehicleId;
  await render(<PickItem />);

  await userEvent.setup().press(screen.getByRole('button', { name: 'Outra manutenção' }));

  expect(router.replace).toHaveBeenCalledWith({ pathname: '/item', params: { vehicleId } });
});
