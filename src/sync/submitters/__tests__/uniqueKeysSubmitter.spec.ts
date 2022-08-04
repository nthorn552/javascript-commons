import { uniqueKeysSubmitterFactory } from '../uniqueKeysSubmitter';
import { loggerMock } from '../../../logger/__tests__/sdkLogger.mock';
import { UniqueKeysCacheInMemory } from '../../../storages/inMemory/uniqueKeysCacheInMemory';

const imp1 = {
  feature: 'someFeature',
  keyName: 'k1',
  changeNumber: 123,
  label: 'someLabel',
  treatment: 'someTreatment',
  time: 0
};
const imp2 = { ...imp1, keyName: 'k2' };
const imp3 = { ...imp1, keyName: 'k3' };
const imp4 = { ...imp1, keyName: 'k3', feature: 'anotherFeature' };

describe('uniqueKeys submitter', () => {
  const uniqueKeysCache = new UniqueKeysCacheInMemory(4);
  const params: any = {
    settings: { log: loggerMock, scheduler: { uniqueKeysRefreshRate: 200 }, core: { key: undefined} },
    storage: { uniqueKeys: uniqueKeysCache },
    splitApi: { 
      postUniqueKeysBulkCs: jest.fn(() => Promise.resolve()),
      postUniqueKeysBulkSs: jest.fn(() => Promise.resolve()) }
  };

  beforeEach(() => {
    params.splitApi.postUniqueKeysBulkCs.mockClear();
    params.splitApi.postUniqueKeysBulkSs.mockClear();
  });

  test('doesn\'t drop items from cache when POST is resolved SS', (done) => {
    const uniqueKeysSubmitter = uniqueKeysSubmitterFactory(params);
    uniqueKeysCache.track(imp1.feature, imp1.keyName);
    uniqueKeysSubmitter.start();

    // Tracking unique keys when POST is pending
    uniqueKeysCache.track(imp2.feature, imp2.keyName);
    uniqueKeysCache.track(imp3.feature, imp3.keyName);
    // Tracking unique keys after POST is resolved
    setTimeout(() => { uniqueKeysCache.track(imp4.feature, imp4.keyName); });

    setTimeout(() => {
      expect(params.splitApi.postUniqueKeysBulkCs.mock.calls).toEqual([]);
      expect(params.splitApi.postUniqueKeysBulkSs.mock.calls).toEqual([
        // POST with imp1
        ['{"keys":[{"f":"someFeature","ks":["k1"]}]}'],
        // POST with imp2 and imp3
        ['{"keys":[{"f":"someFeature","ks":["k2","k3"]},{"f":"anotherFeature","ks":["k3"]}]}']]);
      uniqueKeysSubmitter.stop();

      done();
    }, params.settings.scheduler.uniqueKeysRefreshRate + 10);
  });
  
  test('doesn\'t drop items from cache when POST is resolved CS', (done) => {
    params.settings.core.key = 'emma';
    const uniqueKeysSubmitter = uniqueKeysSubmitterFactory(params);
    uniqueKeysCache.track(imp1.keyName, imp1.feature);
    uniqueKeysSubmitter.start();

    // Tracking unique keys when POST is pending
    uniqueKeysCache.track(imp2.keyName, imp2.feature);
    uniqueKeysCache.track(imp3.keyName, imp3.feature);
    // Tracking unique keys after POST is resolved
    setTimeout(() => { uniqueKeysCache.track(imp4.keyName, imp4.feature); });

    setTimeout(() => {
      expect(params.splitApi.postUniqueKeysBulkSs.mock.calls).toEqual([]);
      expect(params.splitApi.postUniqueKeysBulkCs.mock.calls).toEqual([
        // POST with imp1
        ['{"keys":[{"k":"k1","fs":["someFeature"]}]}'],
        // POST with imp2 and imp3
        ['{"keys":[{"k":"k2","fs":["someFeature"]},{"k":"k3","fs":["someFeature","anotherFeature"]}]}']]);
      uniqueKeysSubmitter.stop();

      done();
    }, params.settings.scheduler.uniqueKeysRefreshRate + 10);
  });
  
});
