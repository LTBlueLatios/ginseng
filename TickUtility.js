const RESET_INTERVAL = 20;

let tickCounter = 0;
const tasks = [];

/**
 * Increments the global tick counter and processes tasks.
 */
export function incrementCounter() {
    tickCounter = (tickCounter + 1) % RESET_INTERVAL;
    tasks.forEach((task, index) => {
        if (tickCounter === task.startTick) {
            task.action();
            tasks.splice(index, 1);
        }
    });
}

/**
 * Schedules a task to be executed after a certain number of ticks.
 * @param {number} delay - Number of ticks to wait before executing the task.
 * @param {Function} action - The task to execute.
 */
export function queueTickTask(delay, action) {
    const startTick = (tickCounter + delay) % RESET_INTERVAL;
    tasks.push({ startTick, action });
}