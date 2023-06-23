import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';


test("Getting info", async function () {
  expect.assertions(2);

  const ACTION_TIME = 200;  // ms
  let queue = new ActionQueue({ workers: 2, rejectCanceled: false, createPromises: true });
  queue.pause();

  let promise = queue.append(() =>
    TimedPromise(ACTION_TIME).then(_ => {
      let {running, pending} = queue.info();
      expect(running.map(({args}) => args)).toEqual([[1], [2]]);
      expect(pending.map(({args}) => args)).toEqual([[3], [4]]);
      pending[0].cancel();  // Cancel the first pending, but not the last.
    }),
    1
  );

  await new Promise((resolve) => {
    queue.append(() => TimedPromise(ACTION_TIME), 2);
    queue.append(function () { throw new Error("Should not be called")}, 3);
    queue.append(_ => TimedPromise(ACTION_TIME).then(resolve), 4);
    promise.catch(function () { throw new Error("Should not be rejected"); });
    queue.resume();
  });
});
