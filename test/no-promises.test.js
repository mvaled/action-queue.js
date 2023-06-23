import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';

test('No promises, ma!',  () => {
  expect.assertions(3);

  const ACTION_TIME = 50;

  function action() {
    return TimedPromise(ACTION_TIME);
  }
  let queue = new ActionQueue({ createPromises: false });

  expect(queue.append(action)).toBeUndefined();
  expect(queue.prepend(action)).toBeUndefined();
  expect(queue.replace(action)).toBeUndefined();
});
