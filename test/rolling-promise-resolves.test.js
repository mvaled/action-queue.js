import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test('External rolling-promise resolves', async () => {
  expect.assertions(0);

  const ACTION_TIME = 100;

  function action(instance) {
    console.debug("Called action", instance);
    let result = TimedPromise(ACTION_TIME);
    result.finally(() => console.log("Action ", instance, "is now done"));
    return result;
  }

  let queue = new ActionQueue();
  await new Promise((resolve, reject) => {
    queue.promise().then(resolve, reject);
    queue.append(_.partial(action, "resolved"));
  });
});
