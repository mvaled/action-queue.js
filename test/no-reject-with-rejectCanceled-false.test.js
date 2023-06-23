import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test("Cancelling with replace, doesn't reject if rejectCanceled is false", async () => {
  expect.assertions(0);

  const ACTION_TIME = 200;  // ms
  let queue = new ActionQueue({ rejectCanceled: false });
  queue.pause();

  let promise = queue.append(() => TimedPromise(ACTION_TIME));
  promise.catch(function () { throw new Error("Should not be rejected"); });
  await new Promise((resolve) => {
    queue.replace(() => TimedPromise(ACTION_TIME).then(resolve));
    queue.resume();
  });
});
