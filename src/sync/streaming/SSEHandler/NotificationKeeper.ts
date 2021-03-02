import { ControlType, PUSH_SUBSYSTEM_UP, PUSH_NONRETRYABLE_ERROR, PUSH_SUBSYSTEM_DOWN } from '../constants';
import { IPushEventEmitter } from '../types';

const CONTROL_CHANNEL_REGEXS = [/control_pri$/, /control_sec$/];

/**
 * Factory of notification keeper, which process OCCUPANCY and CONTROL notifications and emits the corresponding push events.
 *
 * @param pushEmitter emitter for events related to streaming support
 */
// @TODO update logic to handle OCCUPANCY for any region and rename according to new spec (e.g.: PUSH_SUBSYSTEM_UP --> PUSH_SUBSYSTEM_UP)
export default function notificationKeeperFactory(pushEmitter: IPushEventEmitter) {

  let channels = CONTROL_CHANNEL_REGEXS.map(regex => ({
    regex,
    hasPublishers: true, // keep track of publishers presence per channel, in order to compute `hasPublishers`. Init with true, to emit PUSH_SUBSYSTEM_UP if initial OCCUPANCY notifications have 0 publishers
    oTime: -1, // keep track of most recent occupancy notification timestamp per channel
    cTime: -1 // keep track of most recent control notification timestamp per channel
  }));

  // false if the number of publishers is equal to 0 in all regions
  let hasPublishers = true;

  // false if last CONTROL event was STREAMING_PAUSED or STREAMING_DISABLED
  let hasResumed = true;

  function getHasPublishers() { // computes the value of `hasPublishers`
    return channels.some(c => c.hasPublishers);
  }

  return {
    handleOpen() {
      pushEmitter.emit(PUSH_SUBSYSTEM_UP);
    },

    isStreamingUp() {
      return hasResumed && hasPublishers;
    },

    handleOccupancyEvent(publishers: number, channel: string, timestamp: number) {
      for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        if (c.regex.test(channel)) {
          if (timestamp > c.oTime) {
            c.oTime = timestamp;
            c.hasPublishers = publishers !== 0;
            const newHasPublishers = getHasPublishers();
            if (hasResumed) {
              if (!newHasPublishers && hasPublishers) {
                pushEmitter.emit(PUSH_SUBSYSTEM_DOWN);
              } else if (newHasPublishers && !hasPublishers) {
                pushEmitter.emit(PUSH_SUBSYSTEM_UP);
              }
              // nothing to do when hasResumed === false:
              // streaming is already down for `!newHasPublishers`, and cannot be up for `newHasPublishers`
            }
            hasPublishers = newHasPublishers;
          }
          return;
        }
      }
    },

    handleControlEvent(controlType: ControlType, channel: string, timestamp: number) {
      for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        if (c.regex.test(channel)) {
          if (timestamp > c.cTime) {
            c.cTime = timestamp;
            if (controlType === ControlType.STREAMING_DISABLED) {
              pushEmitter.emit(PUSH_NONRETRYABLE_ERROR);
            } else if (hasPublishers) {
              if (controlType === ControlType.STREAMING_PAUSED && hasResumed) {
                pushEmitter.emit(PUSH_SUBSYSTEM_DOWN);
              } else if (controlType === ControlType.STREAMING_RESUMED && !hasResumed) {
                pushEmitter.emit(PUSH_SUBSYSTEM_UP);
              }
              // nothing to do when hasPublishers === false:
              // streaming is already down for `STREAMING_PAUSED`, and cannot be up for `STREAMING_RESUMED`
            }
            hasResumed = controlType === ControlType.STREAMING_RESUMED;
          }
          return;
        }
      }
    },

  };
}
