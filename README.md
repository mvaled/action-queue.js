# A coordinated non-concurrent queue of actions

The class `ActionQueue` allows to create a FIFO, LIFO and replacement of
actions.  An action is a function that returns a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

## API

### `append(fn, ...args)`

Push a new action using a FIFO strategy.  The new action is going to be
executed after all current pending actions in the queue.

Any additional `args` passed to this method is stored and passed to callbacks.

### `prepend(fn, ...args)`

Prepend a new action using a LIFO strategy.  The new action is going to be
executed before all current pending actions in the queue, but after the
currently running action (if any).  The running action is not automatically
cancelled.

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
