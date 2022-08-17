// -*- mode: js2; -*-

(function () {
    /**
     * A collector and runner of coordinated actions.
     *
     * This queue allows you to setup actions (functions that return promises)
     * which are never run concurrently.
     *
     * The API allows actions to be appended to be run in FIFO, LIFO (without
     * replacement) and cancelation (if the underlying supports it) patterns.
     *
     */
    class ActionQueue {
        constructor() {
            // The subscribed callbacks
            this._thens = [];
            this._catchs = [];
            this._finallys = [];
            this._cancels = [];

            // The queue and current running promise (if any).
            this._queue = [];
            this._running = null;

            this._setup_promise();
        }

        /**
         * Register an new callback to call when any of the actions in the queue
         * is completed and not canceled.
         *
         * @param {function} callback
         */
        then(callback) {
            this._thens.push(callback);
        }

        /**
         * Register a new callback to call when any of the actions in the queue
         * is rejected without being cancelled.
         *
         * @param {function} callback
         */
        catch(callback) {
            this._catchs.push(callback);
        }

        /**
         * Register a new callback which is going to be called when any of the
         * actions in the queue is either completed, rejected or cancelled.
         *
         * These callbacks are always called after the other (more specific)
         * callbacks.
         *
         * @param {function} callback
         */
        finally(callback) {
            this._finallys.push(callback);
        }

        /**
         * Register a new callback which is going to be called when any of the
         * actions in the queue is cancelled.
         *
         * @param {function} callback
         */
        oncancel(callback) {
            this._cancels.push(callback);
        }

        /**
         * Insert the action at the beginning of the queue.  If a current action
         * is already running don't cancel it, instead queue the given action to
         * be run later but before any other action in the queue.
         *
         * @param {function} fn The action to perform
         * @param {boolean} force
         * @param  {...any} extra Extra arguments to pass to callbacks
         */
        prepend(fn, ...extra) {
            this._queue = [{ fn: fn, extra: extra }].concat(this._queue);
            this._run();
        }

        /**
         * Insert the action at the end of the queue.
         *
         * @param {function} fn The action to perform
         * @param  {...any} extra Extra arguments to pass to callbacks
         */
        append(fn, ...extra) {
            this._queue.push({ fn: fn, extra: extra });
            this._run();
        }

        /**
         * Replaces the entire queue with the given action.  Cancel pending and
         * running actions.
         *
         * @param {function} fn The action to perform
         * @param  {...any} extra Extra arguments to pass to callbacks
         */
        replace(fn, ...extra) {
            this.clear();
            this.append(fn, ...extra);
        }

        /**
         * Return a promise that resolves/rejects just as soon as the first
         * pending action resolves/rejects.
         *
         * Cancelations don't affect the promise.  If the running action gets
         * cancelled midway, this promise will take over on the next action.
         * If no action is scheduled to be next, we wait.
         *
         * The only way this promise is rejected, is if the running action is
         * rejected.  The only way this promise is resolved, is when the
         * running action is resolved.
         *
         * When the same queue is used several times, calls to promise may
         * return different promises.
         */
        promise() {
            return this._current_promise;
        }

        _setup_promise() {
            let self = this;
            this._current_promise_resolve = null;
            this._current_promise_reject = null;
            this._current_promise = new Promise(function (resolve, reject) {
                self._current_promise_resolve = resolve;
                self._current_promise_reject = reject;
            });
        }

        /**
         * Clear the entire queue.  Cancel pending and running actions.
         */
        clear() {
            let pending = this._queue.concat();
            while (this._queue.length > 0) { this._queue.shift(); }
            this._cancel_running();
            while (pending.length > 0) {
                let action = pending.shift();
                this._cancel_action(action);
            }
        }

        /**
         * Run the next action in the queue.
         *
         * If there's an action running already or if the queue is empty, ignore
         * the request.
         *
         * After the action is finished, request to run the next one.
         */
        _run() {
            if (this._running === null && this._queue.length > 0) {
                let { fn, extra } = this._queue.shift();
                console.debug("Running the next action in the queue", fn, extra);
                let promise = fn();
                this._running = { promise: promise, extra: extra };
                let self = this;
                promise.then(function (...result) {
                    if (result.length == 1 && (typeof result[0]) === "undefined") {
                        result = [];
                    }
                    let extra = (self._running !== null) ? self._running.extra : [];
                    if (self._current_promise_resolve !== null) {
                        self._current_promise_resolve.apply(self, result.concat(extra));
                    }
                    self._setup_promise();
                    self._running = null;
                    self._thens.forEach(function (fn) {
                        try {
                            fn.apply(self, result.concat(extra));
                        } catch (e) {
                            console.error(e);
                        }
                    });
                    self._finallys.forEach(function (fn) {
                        try {
                            fn.apply(self, result.concat(extra));
                        } catch (e) {
                            console.error(e);
                        }
                    });
                    self._run();
                }).catch(function (...result) {
                    if (result.length == 1 && (typeof result[0]) === "undefined") {
                        result = [];
                    }
                    let extra = (self._running !== null) ? self._running.extra : [];
                    if (self._current_promise_reject !== null) {
                        self._current_promise_reject.apply(self, result.concat(extra));
                    }
                    self._setup_promise();
                    self._running = null;
                    self._catchs.forEach(function (fn) {
                        try {
                            fn.apply(self, result.concat(extra));
                        } catch (e) {
                            console.error(e);
                        }
                    });
                    self._finallys.forEach(function (fn) {
                        try {
                            fn.apply(self, result.concat(extra));
                        } catch (e) {
                            console.error(e);
                        }
                    });
                    self._run();
                });
            }
        }

        /**
         * Cancel the running action if any.
         *
         * If the underlying promise has a `cancel` function, call it.  Fallback
         * to `abort`.
         *
         * Call registered callbacks (oncancel and finally).
         */
        _cancel_running() {
            if (this._running !== null) {
                // Some promises reject when cancelled, we let's avoid
                // rejecting the queue's promise in such cases, because our
                // API states that we won't reject the promise when cancelling
                // an action.
                this._current_promise_reject = null;
                let promise = this._running.promise;
                try {
                    if (typeof promise.cancel === "function") {
                        promise.cancel();
                    }
                    else if (typeof promise.abort === "function") {
                        promise.abort();
                    }
                } catch (e) {
                    console.error(e);
                    console.debug("It seems the promise failed to cancel.  I"
                        + " ignore the failure.");
                }
                this._cancel_action(this._running);
                this._running = null;
            }
        }

        /**
         * Call the cancelled and finally callbacks for the action.
         */
        _cancel_action(action) {
            console.debug("Cancelling pending/running action", action);
            let extra = action.extra;
            let self = this;
            this._cancels.forEach(function (fn) {
                try {
                    fn.apply(self, extra);
                } catch (e) {
                    console.error(e);
                }
            });
            this._finallys.forEach(function (fn) {
                try {
                    fn.apply(self, extra);
                } catch (e) {
                    console.error(e);
                }
            });
        }
    }

    this.ActionQueue = ActionQueue;

}).apply(this);
// Local Variables:
// js-indent-level: 4
// End:
