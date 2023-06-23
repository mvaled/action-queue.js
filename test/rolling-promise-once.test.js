import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test('External rolling-promise resolves once and gets renewed', async () => {
  expect.assertions(3);

  let queue = new ActionQueue();

  let instances = [];

  const ACTION_TIME = 50;  // ms
  const LENGTH = 10;       // actions to queue
  const FIRST_WAVE = ACTION_TIME * LENGTH + 100;
  const TOTAL_TIME = FIRST_WAVE * 2;

  function action(instance) {
    instances.push(instance);
    console.debug("Called action", instance);
    return TimedPromise(ACTION_TIME);
  }

  // Even though we push many actions and all are executed, the promise
  // is executed just once (for the first action)
  queue.promise().then((data) => expect(data).toBe(0));

  for (var i = 0; i < LENGTH; i++) {
    queue.append(_.partial(action, i), i);
  }

  TimedPromise(FIRST_WAVE).then(function () {
    queue.promise().then((data) => expect(data).toBe(LENGTH));
    for (var i = 0; i < LENGTH; i++) {
      queue.append(_.partial(action, i + LENGTH), i + LENGTH);
    }
  });

  await new Promise((resolve) => {
    TimedPromise(TOTAL_TIME).then(function () {
      expect(instances).toEqual([...Array(2 * LENGTH).keys()]);
      resolve();
    });
  });
});
