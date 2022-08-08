import { SplitsCacheInMemory } from './SplitsCacheInMemory';
import { SegmentsCacheInMemory } from './SegmentsCacheInMemory';
import { ImpressionsCacheInMemory } from './ImpressionsCacheInMemory';
import { EventsCacheInMemory } from './EventsCacheInMemory';
import { IStorageFactoryParams, IStorageSync } from '../types';
import { ImpressionCountsCacheInMemory } from './ImpressionCountsCacheInMemory';
import { LOCALHOST_MODE, NONE, STORAGE_MEMORY } from '../../utils/constants';
import { TelemetryCacheInMemory } from './TelemetryCacheInMemory';
import { UniqueKeysCacheInMemory } from './uniqueKeysCacheInMemory';

/**
 * InMemory storage factory for standalone server-side SplitFactory
 *
 * @param params parameters required by EventsCacheSync
 */
export function InMemoryStorageFactory(params: IStorageFactoryParams): IStorageSync {

  return {
    splits: new SplitsCacheInMemory(),
    segments: new SegmentsCacheInMemory(),
    impressions: new ImpressionsCacheInMemory(params.impressionsQueueSize),
    impressionCounts: params.optimize || params.impressionsMode === NONE ? new ImpressionCountsCacheInMemory() : undefined,
    events: new EventsCacheInMemory(params.eventsQueueSize),
    telemetry: params.mode !== LOCALHOST_MODE ? new TelemetryCacheInMemory() : undefined, // Always track telemetry in standalone mode on server-side
    uniqueKeys: params.impressionsMode === NONE ? new UniqueKeysCacheInMemory(params.uniqueKeysCacheSize) : undefined,

    // When using MEMORY we should clean all the caches to leave them empty
    destroy() {
      this.splits.clear();
      this.segments.clear();
      this.impressions.clear();
      this.impressionCounts && this.impressionCounts.clear();
      this.events.clear();
      this.uniqueKeys?.clear();
    }
  };
}

InMemoryStorageFactory.type = STORAGE_MEMORY;
