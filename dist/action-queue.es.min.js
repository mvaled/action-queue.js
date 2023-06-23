class p {
  constructor(e) {
    typeof e < "u" ? this._options = {
      createPromises: typeof e.createPromises == "boolean" ? e.createPromises : !0,
      rejectCanceled: typeof e.rejectCanceled == "boolean" ? e.rejectCanceled : !0,
      workers: typeof e.workers == "number" && e.workers > 1 ? e.workers : 1
    } : this._options = {
      createPromises: !0,
      workers: 1,
      rejectCanceled: !0
    }, this._thens = [], this._catchs = [], this._finallys = [], this._cancels = [], this._paused = !1, this._queue = [], this._rolling = null, this._workers = {}, this._idle = /* @__PURE__ */ new Set(), [...Array(this._options.workers).keys()].map((t) => this._idle.add(t));
  }
  /**
   * Register an new callback to call when any of the actions in the queue
   * is completed and not canceled.
   *
   * @param {function} callback
   */
  then(e) {
    this._thens.push(e);
  }
  /**
   * Register a new callback to call when any of the actions in the queue
   * is rejected without being cancelled.
   *
   * @param {function} callback
   */
  catch(e) {
    this._catchs.push(e);
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
  finally(e) {
    this._finallys.push(e);
  }
  /**
   * Register a new callback which is going to be called when any of the
   * actions in the queue is cancelled.
   *
   * @param {function} callback
   */
  oncancel(e) {
    this._cancels.push(e);
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
  prepend(e, ...t) {
    let r = this._build_action(e, t);
    return this._queue.splice(0, 0, r), this._run(), r.external_promise;
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
  append(e, ...t) {
    let r = this._build_action(e, t);
    return this._queue.push(r), this._run(), r.external_promise;
  }
  _build_action(e, t) {
    let r = { resolve: () => {
    }, reject: () => {
    } }, s;
    this._options.createPromises ? s = new Promise(function(h, _) {
      r.resolve = h, r.reject = _;
    }) : s = void 0;
    let o = {
      fn: e,
      connectors: r,
      extra: t,
      external_promise: s,
      inner_promise: void 0,
      cancelled: !1,
      cancel: () => {
        this._cancel_action(o);
      }
    };
    return o;
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
  replace(e, ...t) {
    return this.clear(), this.append(e, ...t);
  }
  /**
   * Clear the entire queue.  Cancel pending and running actions.
   */
  clear() {
    let e = this._queue.concat();
    for (this._queue.splice(0, this._queue.length), this._cancel_running(); e.length > 0; ) {
      let t = e.shift();
      this._cancel_action(t);
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
    return this._rolling === null && this._setup_rolling_promise(), this._rolling.promise;
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
    this._paused = !0;
  }
  /**
   * Resume the queue.
   */
  resume() {
    this._paused = !1, this._run();
  }
  /**
   * Return an object with the running and pending jobs in the queue.
   *
   * The result is an object with two properties: 'running' and 'pending'.
   * Each is an array of objects the a single property `args`; which is an
   * array (possibly empty) with the extra arguments passed to `append`,
   * `prepend` or `replace`.
   *
   */
  info() {
    let e = function(s) {
      let { promise: o, extra: h } = s;
      return { args: h, cancel: s.cancel, promise: s.external_promise };
    };
    const t = Object.values(this._workers), r = [].concat(this._queue);
    return {
      running: t.map(e),
      pending: r.map(e)
    };
  }
  _setup_rolling_promise() {
    let e = this;
    e._rolling = {
      promise: null,
      resolve: null,
      reject: null
    }, e._rolling.promise = new Promise(function(t, r) {
      e._rolling.resolve = t, e._rolling.reject = r;
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
      let e = this._queue.shift(), { fn: t, connectors: r, extra: s, cancelled: o } = e;
      if (o) {
        this._run();
        return;
      }
      let h = t();
      e.inner_promise = h;
      let _ = this._acquire(e), n = this;
      h.then(function(...l) {
        n._release(_);
        try {
          r.resolve(...l);
        } catch (i) {
          console.error(i);
        }
        l.length == 1 && typeof l[0] > "u" && (l = []);
        let a = e.extra || [];
        if (n._rolling !== null) {
          let i = n._rolling.resolve;
          if (typeof i < "u" && i !== null)
            try {
              i.apply(n, l.concat(a));
            } catch (c) {
              console.error(c);
            }
          n._rolling = null;
        }
        n._thens.forEach(function(i) {
          try {
            i.apply(n, l.concat(a));
          } catch (c) {
            console.error(c);
          }
        }), n._finallys.forEach(function(i) {
          try {
            i.apply(n, l.concat(a));
          } catch (c) {
            console.error(c);
          }
        }), n._run();
      }).catch(function(...l) {
        n._release(_);
        try {
          r.reject(...l);
        } catch (i) {
          console.error(i);
        }
        l.length == 1 && typeof l[0] > "u" && (l = []);
        let a = e.extra || [];
        if (n._rolling !== null) {
          let i = n._rolling.reject;
          if (typeof i < "u" && i !== null)
            try {
              i.apply(n, l.concat(a));
            } catch (c) {
              console.error(c);
            }
          n._rolling = null;
        }
        n._catchs.forEach(function(i) {
          try {
            i.apply(n, l.concat(a));
          } catch (c) {
            console.error(c);
          }
        }), n._finallys.forEach(function(i) {
          try {
            i.apply(n, l.concat(a));
          } catch (c) {
            console.error(c);
          }
        }), n._run();
      }), n._run();
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
    for (const e of Object.values(this._workers)) {
      let t = e.inner_promise;
      try {
        typeof t.cancel == "function" ? t.cancel() : typeof t.abort == "function" && t.abort();
      } catch (r) {
        console.error(r);
      }
      this._cancel_action(e);
    }
    this._workers = {}, this._idle = /* @__PURE__ */ new Set(), [...Array(this._options.workers).keys()].map((e) => this._idle.add(e));
  }
  /**
   * Call the cancelled and finally callbacks for the action.
   */
  _cancel_action(e) {
    if (e.cancelled = !0, this._options.rejectCanceled)
      try {
        e.connectors.reject(new Error("Action was cancelled"));
      } catch (s) {
        console.error(s);
      }
    let t = e.extra, r = this;
    this._cancels.forEach(function(s) {
      try {
        s.apply(r, t);
      } catch (o) {
        console.error(o);
      }
    }), this._finallys.forEach(function(s) {
      try {
        s.apply(r, t);
      } catch (o) {
        console.error(o);
      }
    });
  }
  _acquire(e) {
    let r = this._idle.values().next().value;
    return this._idle.delete(r), this._workers[r] = e, r;
  }
  _release(e) {
    delete this._workers[e], this._idle.add(e);
  }
}
export {
  p as ActionQueue
};
