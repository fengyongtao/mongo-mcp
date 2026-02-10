// 导出类型
export type {
  AutoSyncConfig,
  AutoSyncStatus,
  BatchEventHandler,
  EventHandler,
  LocalEventHandler,
  FileChangeEvent,
  FileChangeType,
  RemoteChangeEvent,
  RemoteChangeType,
  SyncEvent,
  WatchTarget,
} from './types.js';

export { defaultAutoSyncConfig } from './types.js';

// 导出核心类
export { AutoSyncScheduler } from './scheduler.js';
export { LocalFileWatcher, getDefaultWatchTargets } from './local-watcher.js';
export { RemoteChangeWatcher } from './remote-watcher.js';
export { SyncEventQueue } from './event-queue.js';
export { SyncCoordinator, type SyncStats } from './coordinator.js';
