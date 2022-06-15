import { fullSettings } from '../../utils/settingsValidation/__tests__/settings.mocks';
import { syncTaskFactory } from './syncTask.mock';
import { syncManagerOnlineFactory } from '../syncManagerOnline';
import { pushManagerFactory } from '../streaming/pushManager';
import { IPushManager } from '../streaming/types';
import { EventEmitter } from '../../utils/MinEvents';
import { IReadinessManager } from '../../readiness/types';

jest.mock('../submitters/submitterManager', () => {
  return {
    submitterManagerFactory: syncTaskFactory
  };
});

const paramsMock = {
  platform: {
    getEventSource: jest.fn(() => { return () => { }; }),
    EventEmitter
  },
  settings: fullSettings,
  storage: {},
  readiness: {},
  start: jest.fn()
};

// Mocked storageManager
const storageManagerMock = {
  splits: {
    usesSegments: () => false
  }
};

// @ts-expect-error
// Mocked readinessManager
let readinessManagerMock = {
  isReady: jest.fn(() => true) // Fake the signal for the non ready SDK
} as IReadinessManager;


// Mocked pollingManager
const pollingManagerMock = {
  syncAll: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  isRunning: jest.fn(),
  add: jest.fn(()=>{return {isrunning: () => true};}),
  get: jest.fn()
};

// Mocked pushManager
const pushManagerMock = pushManagerFactory({ // @ts-ignore
  ...paramsMock, splitApi: { fetchAuth: jest.fn() }
}, {}) as IPushManager;

pushManagerMock.start = jest.fn();

test('syncManagerOnline should start or not the submitter depending on user consent status', () => {
  const settings = { ...fullSettings };

  // @ts-ignore
  const syncManager = syncManagerOnlineFactory()({ settings });
  const submitter = syncManager.submitter!;

  syncManager.start();
  expect(submitter.start).toBeCalledTimes(1); // Submitter should be started if userConsent is undefined
  syncManager.stop();
  expect(submitter.stop).toBeCalledTimes(1);

  settings.userConsent = 'UNKNOWN';
  syncManager.start();
  expect(submitter.start).toBeCalledTimes(1); // Submitter should not be started if userConsent is unknown
  syncManager.stop();
  expect(submitter.stop).toBeCalledTimes(2);

  settings.userConsent = 'GRANTED';
  syncManager.start();
  expect(submitter.start).toBeCalledTimes(2); // Submitter should be started if userConsent is granted
  syncManager.stop();
  expect(submitter.stop).toBeCalledTimes(3);

  settings.userConsent = 'DECLINED';
  syncManager.start();
  expect(submitter.start).toBeCalledTimes(2); // Submitter should not be started if userConsent is declined
  syncManager.stop();
  expect(submitter.stop).toBeCalledTimes(4);

});

test('syncManagerOnline should syncAll a single time in singleSync mode', () => {
  const settings = { ...fullSettings };

  // Enable single sync
  settings.sync.singleSync = true;

  // @ts-ignore
  // Test pushManager for main client
  const syncManager = syncManagerOnlineFactory(() => pollingManagerMock, () => pushManagerMock)({ settings });

  expect(syncManager.pushManager).toBeUndefined();

  // Test pollingManager for Main client
  syncManager.start();

  expect(pollingManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.syncAll).toBeCalledTimes(1);

  syncManager.stop();
  syncManager.start();

  expect(pollingManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.syncAll).toBeCalledTimes(1);

  syncManager.stop();
  syncManager.start();

  expect(pollingManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.syncAll).toBeCalledTimes(1);

  syncManager.stop();

  // @ts-ignore
  // Test pollingManager for shared client
  const pollingSyncManagerShared = syncManager.shared('sharedKey', readinessManagerMock, storageManagerMock);

  if (!pollingSyncManagerShared) throw new Error('pollingSyncManagerShared should exist');

  pollingSyncManagerShared.start();

  expect(pollingManagerMock.start).not.toBeCalled();

  pollingSyncManagerShared.stop();
  pollingSyncManagerShared.start();

  expect(pollingManagerMock.start).not.toBeCalled();

  pollingSyncManagerShared.stop();

  syncManager.start();

  expect(pushManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.start).not.toBeCalled();

  syncManager.stop();
  syncManager.start();

  expect(pushManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.start).not.toBeCalled();

  syncManager.stop();

  // @ts-ignore
  // Test pollingManager for shared client
  const pushingSyncManagerShared = syncManager.shared('pushingSharedKey', readinessManagerMock, storageManagerMock);

  if (!pushingSyncManagerShared) throw new Error('pushingSyncManagerShared should exist');

  pushingSyncManagerShared.start();

  expect(pushManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.start).not.toBeCalled();

  pushingSyncManagerShared.stop();
  pushingSyncManagerShared.start();

  expect(pushManagerMock.start).not.toBeCalled();
  expect(pollingManagerMock.start).not.toBeCalled();

  pushingSyncManagerShared.stop();

  settings.sync.singleSync = false;
  // @ts-ignore
  // pushManager instantiation control test
  const testSyncManager = syncManagerOnlineFactory(() => pollingManagerMock, () => pushManagerMock)({ settings });

  expect(testSyncManager.pushManager).not.toBeUndefined();

  // Test pollingManager for Main client
  testSyncManager.start();

  expect(pushManagerMock.start).toBeCalled();

  testSyncManager.stop();

});
