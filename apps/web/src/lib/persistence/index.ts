import { localPersistenceAdapter } from './local';

export { localPersistenceAdapter } from './local';
export { mockCloudPersistenceAdapter } from './mockCloud';
export type { AppPersistence, RoutineSnapshot, StoredSettings } from './types';

export const persistence = localPersistenceAdapter;
