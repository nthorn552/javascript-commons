import { IPluggableStorageWrapper, IStorageAsync, IStorageAsyncFactory, IStorageFactoryParams } from '../types';

import { KeyBuilderSS } from '../KeyBuilderSS';
import { SplitsCachePluggable } from './SplitsCachePluggable';
import { SegmentsCachePluggable } from './SegmentsCachePluggable';
import { ImpressionsCachePluggable } from './ImpressionsCachePluggable';
import { EventsCachePluggable } from './EventsCachePluggable';
import { wrapperAdapter, METHODS_TO_PROMISE_WRAP } from './wrapperAdapter';
import { isObject } from '../../utils/lang';
import { validatePrefix } from '../KeyBuilder';
import { CONSUMER_PARTIAL_MODE, STORAGE_PLUGGABLE } from '../../utils/constants';
import { ImpressionsCacheInMemory } from '../inMemory/ImpressionsCacheInMemory';
import { EventsCacheInMemory } from '../inMemory/EventsCacheInMemory';
import { ImpressionCountsCacheInMemory } from '../inMemory/ImpressionCountsCacheInMemory';
import { shouldRecordTelemetry, TelemetryCacheInMemory } from '../inMemory/TelemetryCacheInMemory';
import { TelemetryCachePluggable } from './TelemetryCachePluggable';

const NO_VALID_WRAPPER = 'Expecting pluggable storage `wrapper` in options, but no valid wrapper instance was provided.';
const NO_VALID_WRAPPER_INTERFACE = 'The provided wrapper instance doesn’t follow the expected interface. Check our docs.';

export interface PluggableStorageOptions {
  prefix?: string
  wrapper: IPluggableStorageWrapper
}

/**
 * Validate pluggable storage factory options.
 *
 * @param options user options
 * @throws Will throw an error if the options are invalid. Example: wrapper is not provided or doesn't have some methods.
 */
function validatePluggableStorageOptions(options: any) {
  if (!isObject(options) || !isObject(options.wrapper)) throw new Error(NO_VALID_WRAPPER);

  const wrapper = options.wrapper;
  const missingMethods = METHODS_TO_PROMISE_WRAP.filter(method => typeof wrapper[method] !== 'function');
  if (missingMethods.length) throw new Error(`${NO_VALID_WRAPPER_INTERFACE} The following methods are missing or invalid: ${missingMethods}`);
}

// Async return type in `client.track` method on consumer partial mode
// No need to promisify impressions cache
function promisifyEventsTrack(events: any) {
  const origTrack = events.track;
  events.track = function () {
    return Promise.resolve(origTrack.apply(this, arguments));
  };
  return events;
}

/**
 * Pluggable storage factory for consumer server-side & client-side SplitFactory.
 */
export function PluggableStorage(options: PluggableStorageOptions): IStorageAsyncFactory {

  validatePluggableStorageOptions(options);

  const prefix = validatePrefix(options.prefix);

  function PluggableStorageFactory({ log, metadata, onReadyCb, mode, eventsQueueSize, impressionsQueueSize, optimize, matchingKey }: IStorageFactoryParams): IStorageAsync {
    const keys = new KeyBuilderSS(prefix, metadata);
    const wrapper = wrapperAdapter(log, options.wrapper);
    const isPartialConsumer = mode === CONSUMER_PARTIAL_MODE;
    const telemetry = !matchingKey || shouldRecordTelemetry() ?
      isPartialConsumer ? new TelemetryCacheInMemory() : new TelemetryCachePluggable(log, keys, wrapper) :
      undefined;

    const onReadyCbs = [onReadyCb];
    let wrapperConnected: boolean;
    let wrapperConnectError: any;

    // Connects to wrapper and emits SDK_READY event on main client
    wrapper.connect().then(() => {
      wrapperConnected = true;
      onReadyCbs.forEach(onReadyCb => onReadyCb());
      // @ts-ignore
      if (telemetry && telemetry.recordConfig) telemetry.recordConfig();
    }).catch((e) => {
      wrapperConnectError = e || new Error('Error connecting wrapper');
      onReadyCbs.forEach(onReadyCb => onReadyCb(wrapperConnectError));
    });

    return {
      splits: new SplitsCachePluggable(log, keys, wrapper),
      segments: new SegmentsCachePluggable(log, keys, wrapper),
      impressions: isPartialConsumer ? new ImpressionsCacheInMemory(impressionsQueueSize) : new ImpressionsCachePluggable(log, keys.buildImpressionsKey(), wrapper, metadata),
      impressionCounts: optimize ? new ImpressionCountsCacheInMemory() : undefined,
      events: isPartialConsumer ? promisifyEventsTrack(new EventsCacheInMemory(eventsQueueSize)) : new EventsCachePluggable(log, keys.buildEventsKey(), wrapper, metadata),
      telemetry,

      // Disconnect the underlying storage
      destroy() {
        return wrapper.disconnect();
      },

      // emits SDK_READY event on shared clients and returns a reference to the storage
      shared(_, onReadyCb) {
        if (wrapperConnectError || wrapperConnected) onReadyCb(wrapperConnectError);
        else onReadyCbs.push(onReadyCb);

        return {
          ...this,
          // no-op destroy, to disconnect the wrapper only when the main client is destroyed
          destroy() { }
        };
      }
    };
  }

  PluggableStorageFactory.type = STORAGE_PLUGGABLE;
  return PluggableStorageFactory;
}
