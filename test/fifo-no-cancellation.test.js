import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';


test('FIFO queue scenario without cancelation', async () => {
  // Instances hold the actions number ran in the order they were
  // ran.  When the queue is done, we can compare the expected order
  // of actions.
  let instances = [];
  let queue = new ActionQueue();

  const ACTION_TIME = 50;  // ms
  const LENGTH = 10;       // actions to queue
  const TOTAL_TIME = LENGTH * ACTION_TIME;

  expect.assertions(LENGTH + 1);

  function action(instance) {
    instances.push(instance);
    console.debug("Called action", instance);
    return TimedPromise(ACTION_TIME);
  }
  queue.then(function (data) {
    console.debug("Executed then with arguments", arguments);
    expect(data).toSatisfy(data => 0 <= data && data <= LENGTH);
  });
  for (var i = 0; i < LENGTH; i++) {
    queue.append(_.partial(action, i), i);
  }
  await TimedPromise(TOTAL_TIME + 100)
  expect(instances).toEqual([...Array(LENGTH).keys()]);
});
