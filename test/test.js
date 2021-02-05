const {_} = require('underscore');
const {ActionQueue} = require('../src/queue.js');
const {CancelablePromise} = require('./CancelablePromise.js');

function TimedPromise(time, reject_time) {
    return new CancelablePromise(function(resolve, reject, onCancel){
        var reject_handler;
        let resolve_handler = setTimeout(function(){
            if (typeof reject_time !== "undefined")
                clearTimeout(reject_handler);
            resolve();
        }, time);

        if (typeof reject_time !== "undefined") {
            reject_handler = setTimeout(function(){
                reject();
                clearTimeout(resolve_handler);
            }, reject_time);
        }
        onCancel(function(){
            clearTimeout(resolve_handler);
            if (typeof reject_time !== "undefined") {
                clearTimeout(reject_handler);
            }
        });
    });
}

QUnit.module('ActionQueue');

QUnit.test('FIFO queue scenario without cancelation', function(assert){
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    var instances = [];

    let queue = new ActionQueue();

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    const TOTAL_TIME = LENGTH * ACTION_TIME;

    function action(instance) {
        instances.push(instance);
        console.debug("Called action", instance);
        return TimedPromise(ACTION_TIME);
    }

    assert.expect(1);
    assert.timeout(TOTAL_TIME + 500);
    const done = assert.async();
    queue.then(function(){
        if (queue._queue.length === 0 && queue._running === null) {
            assert.deepEqual(instances, [...Array(LENGTH).keys()]);
            done();
        }
    });

    for (var i = 0; i < LENGTH; i++) {
        console.debug("Queing action", i);
        queue.append(_.partial(action, i), "Action number" + i);
    }
});

QUnit.test('LIFO queue scenario without cancelation', function(assert){
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    var instances = [];

    let queue = new ActionQueue();

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    const TOTAL_TIME = LENGTH * ACTION_TIME;

    function action(instance) {
        instances.push(instance);
        console.debug("Called action", instance);
        return TimedPromise(ACTION_TIME);
    }

    assert.expect(2);
    assert.timeout(TOTAL_TIME + 500);
    const done = assert.async();
    queue.then(function(){
        if (queue._queue.length === 0 && queue._running === null) {
            // The first job will be run inmediately, but the next ones will
            // be actually LIFO.
            expected = [...Array(LENGTH).keys()];
            expected.shift(); // Drop 0
            expected.reverse();
            assert.equal(instances.shift(), 0);
            assert.deepEqual(instances, expected);
            done();
        }
    });

    for (var i = 0; i < LENGTH; i++) {
        console.debug("Queing action", i);
        queue.prepend(_.partial(action, i), "Action number" + i);
    }
});

QUnit.test('FIFO queue scenario with cancelation', function(assert){
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    var instances = [];

    let queue = new ActionQueue();

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    // Since only two actions are going to be run.
    const TOTAL_TIME = 2 * ACTION_TIME;

    function action(instance) {
        instances.push(instance);
        console.debug("Called action", instance);
        let result = TimedPromise(ACTION_TIME);
        return result;
    }

    assert.expect(3);
    assert.timeout(TOTAL_TIME + 500);
    const done = assert.async();
    queue.then(function(){
        if (queue._queue.length === 0 && queue._running === null) {
            // In this scenario the first action is run inmediately
            assert.equal(instances.shift(), 0);
            // but then the remaining actions are queue but the last action
            // replaces them
            assert.equal(instances.shift(), LENGTH -1);
            assert.deepEqual(instances, []);
            done();
        }
    });

    for (var i = 0; i < LENGTH; i++) {
        if (i < LENGTH - 1) {
            console.debug("Queing action", i);
            queue.append(_.partial(action, i), "Action number" + i);
        } else {
            console.debug("Replacing queue with action", i);
            queue.replace(_.partial(action, i), "Action number" + i);
        }
    }
});

// Local Variables:
// js-indent-level: 4
// End:
