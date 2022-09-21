const { _ } = require('underscore');
const { ActionQueue } = require('../src/queue.js');
const { CancelablePromise } = require('./CancelablePromise.js');

function TimedPromise(time) {
    return new CancelablePromise(function (resolve, _reject, onCancel) {
        let resolve_handler = setTimeout(resolve, time);
        onCancel(function () {
            clearTimeout(resolve_handler);
        });
    });
}

QUnit.module('ActionQueue');
QUnit.test('FIFO queue scenario without cancelation', function (assert) {
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    let instances = [];

    let queue = new ActionQueue();

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    const TOTAL_TIME = LENGTH * ACTION_TIME;

    function action(instance) {
        instances.push(instance);
        console.debug("Called action", instance);
        return TimedPromise(ACTION_TIME);
    }

    assert.expect(LENGTH + 1);
    assert.timeout(TOTAL_TIME + 500);
    queue.then(function (data) {
        console.debug("Executed then with arguments", arguments);
        assert.ok(0 <= data && data <= LENGTH);
    });

    for (var i = 0; i < LENGTH; i++) {
        queue.append(_.partial(action, i), i);
    }

    let done = assert.async();
    TimedPromise(TOTAL_TIME + 100).then(function () {
        assert.deepEqual(instances, [...Array(LENGTH).keys()]);
        done();
    });
});

QUnit.test('LIFO queue scenario without cancelation', function (assert) {
    // Instances hold the actions number ran in the order they were
    // ran.  When the queue is done, we can compare the expected order
    // of actions.
    let instances = [];

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
    queue.then(function () {
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

let buildFIFOScenario = function (createPromises) {
    return function (assert) {
        // Instances hold the actions number ran in the order they were
        // ran.  When the queue is done, we can compare the expected order
        // of actions.
        let instances = [];

        let queue = new ActionQueue({ createPromises: createPromises });

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
        queue.then(function () {
            if (queue._queue.length === 0 && queue._running === null) {
                // In this scenario the first action is run inmediately
                assert.equal(instances.shift(), 0);
                // but then the remaining actions are queue but the last action
                // replaces them
                assert.equal(instances.shift(), LENGTH - 1);
                assert.deepEqual(instances, []);
                done();
            }
        });

        for (var i = 0; i < LENGTH; i++) {
            if (i < LENGTH - 1) {
                console.debug("Queing action", i);
                let result = queue.append(_.partial(action, i), "Action" + " number" + i);
                if (createPromises)
                    result.catch(() => {});
            } else {
                console.debug("Replacing queue with action", i);
                queue.replace(_.partial(action, i), "Action number" + i);
            }
        }
    };
};

QUnit.test('FIFO queue scenario with cancelation, with promises', buildFIFOScenario(true));
QUnit.test('FIFO queue scenario with cancelation, with no promises', buildFIFOScenario(false));

QUnit.test('External promises resolve', function (assert) {
    const ACTION_TIME = 100;
    let done = assert.async();
    assert.timeout(ACTION_TIME * 3);
    assert.expect(0);

    function action(instance) {
        console.debug("Called action", instance);
        let result = TimedPromise(ACTION_TIME);
        result.finally(() => console.log("Action ", instance, "is now done"));
        return result;
    }

    let queue = new ActionQueue();
    queue
        .append(_.partial(action, "rejected"))
        .then(done, () => assert.ok(false));
});



QUnit.test('External promises reject', function (assert) {
    const ACTION_TIME = 100;
    let done = assert.async();
    assert.timeout(ACTION_TIME * 3);
    assert.expect(0);

    function action(instance) {
        console.debug("Called action", instance);
        return new Promise(
            (_, reject) => TimedPromise(ACTION_TIME).then(reject)
        ).finally(() => console.log("Action ", instance, "is now done"));
    }

    let queue = new ActionQueue();
    queue
        .append(_.partial(action, "rejected"))
        .then(() => assert.ok(false), done);
});


QUnit.test('External rolling-promise resolves', function (assert) {
    const ACTION_TIME = 100;
    let done = assert.async();
    assert.timeout(ACTION_TIME * 3);
    assert.expect(0);

    function action(instance) {
        console.debug("Called action", instance);
        let result = TimedPromise(ACTION_TIME);
        result.finally(() => console.log("Action ", instance, "is now done"));
        return result;
    }

    let queue = new ActionQueue();
    queue.promise().then(done, () => assert.ok(false));
    queue.append(_.partial(action, "resolved"));
});



QUnit.test('External rolling-promise reject', function (assert) {
    const ACTION_TIME = 100;
    let done = assert.async();
    assert.timeout(ACTION_TIME * 3);
    assert.expect(0);

    function action(instance) {
        console.debug("Called action", instance);
        return new Promise(
            (_, reject) => TimedPromise(ACTION_TIME).then(reject)
        ).finally(() => console.log("Action ", instance, "is now done"));
    }

    let queue = new ActionQueue();
    queue.promise().then(() => assert.ok(false), done);
    queue.append(_.partial(action, "rejected")).catch(() => {});
});

QUnit.test('External rolling-promise resolves once and gets renewed', function (assert) {
    let queue = new ActionQueue();

    let instances = [];

    const ACTION_TIME = 50;  // ms
    const LENGTH = 10;       // actions to queue
    const FIRST_WAVE = ACTION_TIME * LENGTH + 100;
    const TOTAL_TIME = FIRST_WAVE * 2;

    function action(instance) {
        instances.push(instance);
        console.debug("Called action", instance);
        return TimedPromise(ACTION_TIME);
    }

    // Even though we push many actions and all are executed, the promise
    // is executed just once (for the first action)
    assert.expect(3);
    queue.promise().then((data) => assert.equal(data, 0));
    for (var i = 0; i < LENGTH; i++) {
        queue.append(_.partial(action, i), i);
    }
    TimedPromise(FIRST_WAVE).then(function () {
        queue.promise().then((data) => assert.equal(data, LENGTH));
        for (var i = 0; i < LENGTH; i++) {
            queue.append(_.partial(action, i + LENGTH), i + LENGTH);
        }
    });

    assert.timeout(TOTAL_TIME + 100);
    let done = assert.async();
    TimedPromise(TOTAL_TIME).then(function () {
        assert.deepEqual(instances, [...Array(2 * LENGTH).keys()]);
        done();
    });
});

QUnit.test('No promises, ma!', function (assert) {
    const ACTION_TIME = 50;
    function action() {
        return TimedPromise(ACTION_TIME);
    }
    assert.expect(3);
    let queue = new ActionQueue({ createPromises: false });
    assert.ok(typeof queue.append(action) === "undefined");
    assert.ok(typeof queue.prepend(action) === "undefined");
    assert.ok(typeof queue.replace(action) === "undefined");
});
