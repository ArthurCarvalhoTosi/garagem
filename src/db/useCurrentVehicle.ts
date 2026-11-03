import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { Db } from './client';
import { selectedVehicleIdQuery, vehiclesQuery } from './repo';

/**
 * The car the tabs show: the selected one, or the oldest when there's no pref (upgrade) or it was removed.
 * `undefined` while the first reads run ([] then doesn't mean "no car" yet); `null` when there is no car.
 */
export function useCurrentVehicle(db: Db) {
  const cars = useLiveQuery(vehiclesQuery(db));
  const selected = useLiveQuery(selectedVehicleIdQuery(db));
  const failed = cars.error ?? selected.error;
  if (failed) throw failed;
  if (!cars.updatedAt || !selected.updatedAt) return undefined;
  return cars.data.find((v) => v.id === selected.data[0]?.value) ?? cars.data[0] ?? null;
}
