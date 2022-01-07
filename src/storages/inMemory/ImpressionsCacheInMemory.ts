import { IImpressionsCacheSync } from '../types';
import { ImpressionDTO } from '../../types';

export class ImpressionsCacheInMemory implements IImpressionsCacheSync {

  private queue: ImpressionDTO[] = [];

  /**
   * Store impressions in sequential order
   */
  track(data: ImpressionDTO[]) {
    this.queue.push(...data);
  }

  /**
   * Clear the data stored on the cache.
   */
  clear() {
    this.queue = [];
  }

  /**
   * Get the collected data, used as payload for posting.
   */
  state() {
    return this.queue;
  }

  /**
   * Check if the cache is empty.
   */
  isEmpty() {
    return this.queue.length === 0;
  }
}
