import { CancelablePromise } from './CancelablePromise.js';

export function TimedPromise(time) {
  return new CancelablePromise(function (resolve, _reject, onCancel) {
    let resolve_handler = setTimeout(resolve, time);
    onCancel(function () {
      clearTimeout(resolve_handler);
    });
  });
}
