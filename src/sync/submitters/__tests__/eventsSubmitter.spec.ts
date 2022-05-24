import { eventsSubmitterFactory } from '../eventsSubmitter';
import { loggerMock } from '../../../logger/__tests__/sdkLogger.mock';



describe('Events submitter', () => {

  let __onFullQueueCb: () => void;
  const eventsCacheMock = {
    isEmpty: jest.fn(() => true),
    setOnFullQueueCb: jest.fn(function (onFullQueueCb) { __onFullQueueCb = onFullQueueCb; })
  };
  const params = {
    settings: {
      log: loggerMock,
      scheduler: { eventsPushRate: 30000 },
      startup: { eventsFirstPushWindow: 0 }
    },
    splitApi: { postEventsBulkMock: jest.fn() },
    storage: { events: eventsCacheMock }
  };

  beforeEach(() => {
    eventsCacheMock.isEmpty.mockClear();
  });

  test('with eventsFirstPushWindow', async () => {
    const eventsFirstPushWindow = 20;
    params.settings.startup.eventsFirstPushWindow = eventsFirstPushWindow; // @ts-ignore
    const eventsSubmitter = eventsSubmitterFactory(params);

    eventsSubmitter.start();
    expect(eventsSubmitter.isRunning()).toEqual(true); // Submitter should be flagged as running
    expect(eventsSubmitter.isExecuting()).toEqual(false); // but not executed immediatelly if there is a push window
    expect(eventsCacheMock.isEmpty).not.toBeCalled();

    // If queue is full, submitter should be executed
    __onFullQueueCb();
    expect(eventsSubmitter.isExecuting()).toEqual(true);
    expect(eventsCacheMock.isEmpty).toBeCalledTimes(1);

    // Await first push window
    await new Promise(res => setTimeout(res, eventsFirstPushWindow + 10));
    expect(eventsCacheMock.isEmpty).toBeCalledTimes(2); // after the push window, submitter should have been executed

    expect(eventsSubmitter.isRunning()).toEqual(true);
    eventsSubmitter.stop();
    expect(eventsSubmitter.isRunning()).toEqual(false);
  });

  test('without eventsFirstPushWindow', async () => {
    const eventsFirstPushWindow = 0;
    params.settings.startup.eventsFirstPushWindow = eventsFirstPushWindow; // @ts-ignore
    const eventsSubmitter = eventsSubmitterFactory(params);

    eventsSubmitter.start();
    expect(eventsSubmitter.isRunning()).toEqual(true); // Submitter should be flagged as running
    expect(eventsSubmitter.isExecuting()).toEqual(true); // and executes immediatelly if there isn't a push window
    expect(eventsCacheMock.isEmpty).toBeCalledTimes(1);

    // If queue is full, submitter should be executed
    __onFullQueueCb();
    expect(eventsSubmitter.isExecuting()).toEqual(true);
    expect(eventsCacheMock.isEmpty).toBeCalledTimes(2);

    expect(eventsSubmitter.isRunning()).toEqual(true);
    eventsSubmitter.stop();
    expect(eventsSubmitter.isRunning()).toEqual(false);
  });

});
