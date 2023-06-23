import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test("Cancelling with replace, rejects", async () => {
  expect.assertions(1);

  const ACTION_TIME = 50;  // ms

  let queue = new ActionQueue();
  queue.pause();
  
  let promise = expect(queue.append(() => TimedPromise(ACTION_TIME))).rejects.toThrow("Action was cancelled");
  queue.replace(() => TimedPromise(ACTION_TIME));

  await promise;
});
