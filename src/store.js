const tasks = new Map();

let nextId = 1;

function listTasks() {
  return Array.from(tasks.values()).sort((a, b) => a.id - b.id);
}

function createTask(title, owner = 'student') {
  const trimmedTitle = String(title || '').trim();
  const trimmedOwner = String(owner || 'student').trim() || 'student';

  if (!trimmedTitle) {
    const error = new Error('Task title is required.');
    error.statusCode = 400;
    throw error;
  }

  const task = {
    id: nextId++,
    title: trimmedTitle,
    owner: trimmedOwner,
    createdAt: new Date().toISOString()
  };

  tasks.set(task.id, task);
  return task;
}

function getTask(id) {
  const numericId = Number.parseInt(id, 10);
  return tasks.get(numericId) || null;
}

function resetStore() {
  tasks.clear();
  nextId = 1;
}

module.exports = {
  createTask,
  getTask,
  listTasks,
  resetStore
};
