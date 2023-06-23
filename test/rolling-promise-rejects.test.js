import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';


test('External rolling-promise reject', async () => {
  expect.assertions(0);

  const ACTION_TIME = 100;

  function action(instance) {
    console.debug("Called action", instance);
    return new Promise(
      (_, reject) => TimedPromise(ACTION_TIME).then(reject)
    ).finally(() => console.log("Action ", instance, "is now done"));
  }

  let queue = new ActionQueue();
  await new Promise((resolve, reject) => {
    queue.promise().then(reject, resolve);
    queue.append(_.partial(action, "rejected")).catch(() => {});
  });
});
