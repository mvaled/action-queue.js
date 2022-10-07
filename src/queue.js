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
     * You can pass an object with options:
     *
     * - `createPromises`, it should be a bool to indicate if the functions
     *    'append', 'prepend' and 'replace' should create and promises.
     *    Defaults to true.
     *
     * - `workers`, if present it should a small integer to indicate the
     *   amount of actions the queue can run concurrently.  We advice that you
     *   really small number: max. 10.  The default is 1, which means no
     *   concurrency.
     *
     */
    class ActionQueue {
        constructor(options) {
            if (typeof options !== "undefined") {
                this._options = {
                    createPromises: !!options.createPromises,
                    workers: typeof options.workers == "number" &&
                        options.workers > 1
                        ? options.workers : 1,
                };
            } else {
                this._options = { createPromises: true, workers: 1 };
            }

            // The subscribed callbacks
            this._thens = [];
            this._catchs = [];
            this._finallys = [];
            this._cancels = [];

            // The queue state: paused, the pending jobs, the running actions,
            // and the *rolling* promise if any.
            this._paused = false;
            this._queue = [];
            this._rolling = null;

            this._workers = {};
            this._idle = new Set();
            [...Array(this._options.workers).keys()].map(x => this._idle.add(x));
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
         *
         * If the option `createPromises` is true, return a promise that is
         * equivalent to the one that would be returned by the action after it
         * starts running.  This promise will resolve only if/when the action
         * runs and resolves, and it will reject when the action rejects or is
         * cancelled.
         *
         * If `createPromises` is false, return undefined.
         */
        prepend(fn, ...extra) {
            let connectors = { resolve: () => {}, reject: () => {} };
            let result;
            if (this._options.createPromises) {
                result = new Promise(function (resolve, reject) {
                    connectors.resolve = resolve;
                    connectors.reject = reject;
                });
            } else {
                result = undefined;
            }
            this._queue = [{ fn: fn, connectors: connectors, extra: extra }].concat(this._queue);
            this._run();
            return result;
        }

        /**
         * Insert the action at the end of the queue.
         *
         * @param {function} fn The action to perform
         * @param  {...any} extra Extra arguments to pass to callbacks
         *
         * If the option `createPromises` is true, return a promise that is
         * equivalent to the one that would be returned by the action after it
         * starts running.  This promise will resolve only if/when the action
         * runs and resolves, and it will reject when the action rejects or is
         * cancelled.
         *
         * If `createPromises` is false, return undefined.
         */
        append(fn, ...extra) {
            let connectors = { resolve: () => {}, reject: () => {} };
            let result;
            if (this._options.createPromises) {
                result = new Promise(function (resolve, reject) {
                    connectors.resolve = resolve;
                    connectors.reject = reject;
                });
            } else {
                result = undefined;
            }
            this._queue.push({ fn: fn, connectors: connectors, extra: extra });
            this._run();
            return result;
        }

        /**
         * Replaces the entire queue with the given action.  Cancel pending and
         * running actions.
         *
         * @param {function} fn The action to perform
         * @param  {...any} extra Extra arguments to pass to callbacks
         *
         * Returns a promise that is equivalent to the one that would be
         * returned by the action after it starts running.  This promise will
         * resolve only if/when the action runs and resolves, and it will
         * reject when the action rejects or is cancelled.
         */
        replace(fn, ...extra) {
            this.clear();
            return this.append(fn, ...extra);
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
         * Return the length of the queue
         */
        length() {
            return this._queue.length + this.running();
        }

        /**
         * Return the amount of tasks currently running.
         */
        running() {
            return this._options.workers - this._idle.size;
        }


        /**
         * Return True if the queue is busy, either running or with waiting
         * actions.
         */
        busy() {
            return this.length() > 0;
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
            if (this._rolling === null)
                this._setup_rolling_promise();
            return this._rolling.promise;
        }

        /**
         * Return true if the queue is paused.
         */
        paused() {
            return this._paused;
        }

        /**
         * Pause the queue.  No tasks are going to be run.
         */
        pause() {
            this._paused = true;
        }

        /**
         * Resume the queue.
         */
        resume() {
            this._paused = false;
            this._run();
        }

        _setup_rolling_promise() {
            let self = this;
            self._rolling = {
                promise: null,
                resolve: null,
                reject: null,
            };
            self._rolling.promise = new Promise(function (resolve, reject) {
                self._rolling.resolve = resolve;
                self._rolling.reject = reject;
            });
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
            if (!this.paused() && this._idle.size > 0 && this._queue.length > 0) {
                let { fn, connectors, extra } = this._queue.shift();
                let promise = fn();
                let running = { promise: promise, connectors: connectors, extra: extra };
                let index = this._acquire(running);
                let self = this;
                promise.then(function (...result) {
                    self._release(index);  /// Release the worker ASAP.
                    try {
                        connectors.resolve(...result);
                    } catch (e) {
                        console.error(e);
                    }
                    if (result.length == 1 && (typeof result[0]) === "undefined") {
                        result = [];
                    }

                    let extra = running.extra || [];
                    if (self._rolling !== null) {
                        let rolling_resolve = self._rolling.resolve;
                        if (typeof rolling_resolve != "undefined" && rolling_resolve !== null) {
                            try {
                                rolling_resolve.apply(self, result.concat(extra));
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        self._rolling = null;
                    }
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
                    self._release(index);  /// Release the worker ASAP.
                    try {
                        connectors.reject(...result);
                    } catch (e) {
                        console.error(e);
                    }
                    if (result.length == 1 && (typeof result[0]) === "undefined") {
                        result = [];
                    }

                    let extra = running.extra || [];
                    if (self._rolling !== null) {
                        let rolling_reject = self._rolling.reject;
                        if (typeof rolling_reject != "undefined" && rolling_reject !== null) {
                            try {
                                rolling_reject.apply(self, result.concat(extra));
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        self._rolling = null;
                    }
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
                /// This call is needed to fill the next worker if some is
                /// idle.
                self._run();
            }
        }

        /**
         * Cancel all running actions if any.
         *
         * If the underlying promise has a `cancel` function, call it.  Fallback
         * to `abort`.
         *
         * Call registered callbacks (oncancel and finally).
         */
        _cancel_running() {
            for (const action of Object.values(this._workers)) {
                // Some promises reject when cancelled, we let's avoid
                // rejecting the queue's promise in such cases, because our
                // API states that we won't reject the promise when cancelling
                // an action.
                let promise = action.promise;
                try {
                    if (typeof promise.cancel === "function") {
                        promise.cancel();
                    }
                    else if (typeof promise.abort === "function") {
                        promise.abort();
                    }
                } catch (e) {
                    console.error(e);
                }
                this._cancel_action(action);
            }
            this._workers = {};
            this._idle = new Set();
            [...Array(this._options.workers).keys()].map(x => this._idle.add(x));
        }

        /**
         * Call the cancelled and finally callbacks for the action.
         */
        _cancel_action(action) {
            try {
                action.connectors.reject(new Error("Action was cancelled"));
            }
            catch (e) {
                console.error(e);
            }
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

        _acquire(item) {
            let values = this._idle.values();
            let result = values.next().value;
            this._idle.delete(result);
            this._workers[result] = item;
            return result;
        }

        _release(index) {
            delete this._workers[index];
            this._idle.add(index);
        }
    }

    this.ActionQueue = ActionQueue;

}).apply(this);
// Local Variables:
// js-indent-level: 4
// End:
