import { ActionQueue } from '../src/index.js';
import { CancelablePromise } from './utils/CancelablePromise.js';
import { TimedPromise } from './utils/TimedPromise.js';
import _ from 'underscore';

import { test, expect } from 'vitest';


test('Workers with FIFO pattern', async () => {
  const WORKERS = 5;
  const LENGTH = 50;
  const ACTION_TIME = 200;
  const TOTAL_TIME = LENGTH * ACTION_TIME / WORKERS + ACTION_TIME;

  var siblings = 0;
  let queue = new ActionQueue({ workers: WORKERS });

  expect.assertions(1);

  let result = new Promise((resolve) => {
    queue.then(() => {
      if (!queue.busy()) {
        /// We won't be able to actually see WORKERS here because, when the
        // action get's scheduled at most WORKERS - 1 can be running,
        // otherwise it won't be an available worker for the new task to run.
        expect(siblings).toBe(WORKERS - 1);
        resolve();
      }
    });
  });    

  queue.pause();

  function action(index) {
    let running = queue.running();
    if (running > siblings) {
      siblings = running;
    }
    return TimedPromise(ACTION_TIME).then(
      () => console.log("Action done", index)
    );
  }

  for (var i = 0; i < LENGTH; i++) {
    queue.append(_.partial(action, i), i);
  }
  queue.resume();

  await result;
});
