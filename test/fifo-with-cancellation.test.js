import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

let buildFIFOScenario = function (createPromises) {
  return  async function () {
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    let instances = [];
    let queue = new ActionQueue({ createPromises: createPromises });

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    // Since only two actions are going to be run.
    const TOTAL_TIME = 2 * ACTION_TIME;

    expect.assertions(3);

    function action(instance) {
      instances.push(instance);
      console.debug("Called action", instance);
      let result = TimedPromise(ACTION_TIME);
      return result;
    }

    await new Promise((resolve) => {
      queue.then(function () {
        if (!queue.busy()) {
          // In this scenario the first action is run inmediately
          expect(instances.shift()).toBe(0);
          // but then the remaining actions are queue but the last action
          // replaces them
          expect(instances.shift()).toBe(LENGTH - 1);
          expect(instances).toEqual([]);
          resolve();
        }
      });

      for (var i = 0; i < LENGTH; i++) {
        if (i < LENGTH - 1) {
          console.debug("Queing action", i);
          let result = queue.append(_.partial(action, i), "Action" + " number" + i);
          if (createPromises)
            result.catch(() => {});
        } else {
          console.debug("Replacing queue with action", i);
          queue.replace(_.partial(action, i), "Action number" + i);
        }
      }});
  }
}

test('FIFO queue scenario with cancelation, with promises', buildFIFOScenario(true));
test('FIFO queue scenario with cancelation, with no promises', buildFIFOScenario(false));
