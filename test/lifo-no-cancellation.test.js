import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test('LIFO queue scenario without cancelation', async () => {
  // Instances hold the actions number ran in the order they were
  // ran.  When the queue is done, we can compare the expected order
  // of actions.
  let instances = [];

  let queue = new ActionQueue();

  const ACTION_TIME = 50;  // ms
  const LENGTH = 10;       // actions to queue
  const TOTAL_TIME = LENGTH * ACTION_TIME;

  expect.assertions(2);

  function action(instance) {
    instances.push(instance);
    console.debug("Called action", instance);
    return TimedPromise(ACTION_TIME);
  }

  await new Promise((resolve) => {
    queue.then(function () {
      if (!queue.busy()) {
        // The first job will be run inmediately, but the next ones will
        // be actually LIFO.
        let expected = [...Array(LENGTH).keys()];
        expected.shift(); // Drop 0
        expected.reverse();
        expect(instances.shift()).toEqual(0);
        expect(instances).toEqual(expected);
        resolve();
      }
    });
    for (var i = 0; i < LENGTH; i++) {
      console.debug("Queing action", i);
      queue.prepend(_.partial(action, i), "Action number" + i);
    }
  });
});
