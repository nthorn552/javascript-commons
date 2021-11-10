import { ICustomStorageWrapper, IStorageAsync, IStorageAsyncFactory, IStorageFactoryParams } from '../types';

import KeyBuilderSS from '../KeyBuilderSS';
import { SplitsCachePluggable } from './SplitsCachePluggable';
import { SegmentsCachePluggable } from './SegmentsCachePluggable';
import { ImpressionsCachePluggable } from './ImpressionsCachePluggable';
import { EventsCachePluggable } from './EventsCachePluggable';
import { wrapperAdapter, METHODS_TO_PROMISE_WRAP } from './wrapperAdapter';
import { isObject } from '../../utils/lang';
import { validatePrefix } from '../KeyBuilder';
import { STORAGE_CUSTOM } from '../../utils/constants';

const NO_VALID_WRAPPER = 'Expecting custom storage `wrapper` in options, but no valid wrapper instance was provided.';
const NO_VALID_WRAPPER_INTERFACE = 'The provided wrapper instance doesn’t follow the expected interface. Check our docs.';

export interface PluggableStorageOptions {
  prefix?: string
  wrapper: ICustomStorageWrapper
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

// subscription to wrapper connect event in order to emit SDK_READY event
function wrapperConnect(wrapper: ICustomStorageWrapper, onReadyCb: (error?: any) => void) {
  wrapper.connect().then(() => {
    onReadyCb();
  }).catch((e) => {
    onReadyCb(e || new Error('Error connecting wrapper'));
  });
}

/**
 * Pluggable storage factory for consumer server-side & client-side SplitFactory.
 */
export function PluggableStorage(options: PluggableStorageOptions): IStorageAsyncFactory {

  validatePluggableStorageOptions(options);

  const prefix = validatePrefix(options.prefix);

  function PluggableStorageFactory({ log, metadata, onReadyCb }: IStorageFactoryParams): IStorageAsync {
    const keys = new KeyBuilderSS(prefix, metadata);
    const wrapper = wrapperAdapter(log, options.wrapper);

    // emit SDK_READY event on main client
    wrapperConnect(wrapper, onReadyCb);

    return {
      splits: new SplitsCachePluggable(log, keys, wrapper),
      segments: new SegmentsCachePluggable(log, keys, wrapper),
      impressions: new ImpressionsCachePluggable(log, keys.buildImpressionsKey(), wrapper, metadata),
      events: new EventsCachePluggable(log, keys.buildEventsKey(), wrapper, metadata),
      // @TODO add telemetry cache when required

      // Disconnect the underlying storage, to release its resources (such as open files, database connections, etc).
      destroy() {
        return wrapper.close();
      },

      // emits SDK_READY event on shared clients and returns a reference to the storage
      shared(_, onReadyCb) {
        wrapperConnect(wrapper, onReadyCb);
        return {
          ...this,
          // no-op destroy, to close the wrapper only when the main client is destroyed
          destroy() { }
        };
      }
    };
  }

  PluggableStorageFactory.type = STORAGE_CUSTOM;
  return PluggableStorageFactory;
}
