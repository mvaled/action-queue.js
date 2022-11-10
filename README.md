# A coordinated non-concurrent queue of actions

The class `ActionQueue` allows to create a FIFO, LIFO and replacement of
actions.  An action is a function that returns a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

## API

### `new ActionQueue(options)`

Creates a new action queue.  You can pass an object with options:

- `createPromises`, it should be a bool to indicate if the functions
   'append', 'prepend' and 'replace' should create and promises.
   Defaults to true.

- `rejectCanceled`, it should be a bool to indicate if we reject the promises
  (if `createPromises` is also true) that are cancelled while still in the
  queue.  See the methods `replace` and `clear` below.

- `workers`, if present it should a small integer to indicate the
  amount of actions the queue can run concurrently.  We advice that you
  really small number: max. 10.  The default is 1, which means no
  concurrency.  Ignored if not a number, or smaller than 1.


### `append(fn, ...args)`

Push a new action using a FIFO strategy.  The new action is going to be
executed after all current pending actions in the queue.

If the option `createPromises` is true, return a promise that is
equivalent to the one that would be returned by the action after it
starts running.  This promise will resolve only if/when the action
runs and resolves, and it will reject when the action rejects or is
cancelled.

If `createPromises` is false, return undefined.

Any additional `args` passed to this method is stored and passed to callbacks.

### `prepend(fn, ...args)`

Prepend a new action using a LIFO strategy.  If a current action is already
running don't cancel it, instead queue the given action to be run later but
before any other action in the queue.

If the option `createPromises` is true, return a promise that is
equivalent to the one that would be returned by the action after it
starts running.  This promise will resolve only if/when the action
runs and resolves, and it will reject when the action rejects or is
cancelled.

If `createPromises` is false, return undefined.

Any additional `args` passed to this method is stored and passed to callbacks.

### `replace(fn, ...args)`

Cancel all pending and running actions in the queue and replace it with a new
action.   This is the same as calling `clear` and then `append`.

### `clear()`

Cancel all pending and running actions in the queue.


### `then(callback)`

Register a callback to be called when any of the actions is completed
successfully without being cancelled from the queue.

The callbacks will receive all arguments the underlying Promise yields when
resolving plus the extra `args` passed in `append` or `prepend`.


### `catch(callback)`

Register a callback to be called when any of the actions is rejected without
being cancelled.

The callbacks will receive all arguments the underlying Promise yields when
resolving plus the extra `args` passed in `append` or `prepend`.


### `finally(callback)`

Register a callback to be called when any of the actions is resolved, rejected
or cancelled (evicted from the queue).

The callbacks will receive all arguments the underlying Promise yields when
resolving plus the extra `args` passed in `append` or `prepend`.  If the
action was actually cancelled, there's no result and only the extra `args` are
passed.

### `oncancel(callback)`

Register a callback to be called when any of the actions is cancelled (evicted
from the queue).

The callbacks will receive the extra `args` passed in `append` or `prepend`.


### `length()`

Return the length of queue including the running action.

### `promise()`

Return a promise that resolves/rejects just as soon as the first
pending/running action resolves/rejects.

Cancelations don't affect the promise.  If the running action gets cancelled
midway, this promise will take over on the next action.  If no action is
scheduled to be next, we wait.

The only way this promise is rejected, is if the running action is rejected.
The only way this promise is resolved, is when the running action is resolved.

When the same queue is used several times, calls to promise may return
different promises.
