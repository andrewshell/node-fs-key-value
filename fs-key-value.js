'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const fsExt = require('fs-ext');
const path = require('path');
const { promisify } = require('util');

const flock = promisify(fsExt.flock);

/**
 * Run `body` while holding an flock on `filepath`. The fd is opened only to
 * carry the flock; the body reads/writes through other fs calls. Release and
 * close failures inside the finally are intentionally swallowed so the caller
 * still sees the real underlying error.
 */
async function withFlock(filepath, openFlags, mode, body) {
  let fd = null;
  try {
    fd = fs.openSync(filepath, openFlags, 0o666);
    await flock(fd, mode);
    return await body();
  } finally {
    if (fd !== null) {
      try {
        await flock(fd, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

const withDirectoryLock = (dirLockPath, mode, body) =>
  withFlock(dirLockPath, 'a', mode, body);
const withKeyLock = (filename, mode, body) =>
  withFlock(filename, 'a+', mode, body);

/**
 * Adapt a promise to a node-style callback. If `callback` is not a function,
 * a default that throws on error is used. `adaptArgs(value)` returns the
 * argument list passed on success — defaults to `[null]` for void-resolve
 * methods. Override for methods that pass a value (or, like `get`, deliberately
 * call back with no args so `err === undefined`).
 */
function toCallback(promise, callback, adaptArgs = () => [null]) {
  if (typeof callback !== 'function') {
    callback = function (err) {
      if (err) {
        throw err;
      }
    };
  }
  promise.then(
    (value) => callback(...adaptArgs(value)),
    (err) => callback(err)
  );
}

/**
 * @callback ErrorCallback
 * @param {Error|null} err - Error if one occurred
 */

/**
 * @callback GetCallback
 * @param {Error|null} err - Error if one occurred
 * @param {*} [value] - The retrieved value, or undefined if key doesn't exist
 */

/**
 * @callback OpenCallback
 * @param {Error|null} err - Error if one occurred
 * @param {FsKeyValue} [instance] - The initialized FsKeyValue instance
 */

/**
 * Filesystem-based key-value store with file locking.
 *
 * Stores values as JSON files in a directory, using POSIX file locks
 * for safe concurrent access.
 *
 * @constructor
 * @param {string} [directory] - Path to storage directory
 * @param {OpenCallback} [callback] - Called when initialization completes
 *
 * @example
 * var FsKeyValue = require('fs-key-value');
 * var store = new FsKeyValue('/tmp/mydb', function(err, db) {
 *   if (err) throw err;
 *   db.put('mykey', { foo: 'bar' }, function(err) {
 *     if (err) throw err;
 *     console.log('Value stored');
 *   });
 * });
 */
function FsKeyValue(directory, callback) {
  if (directory) {
    this.open(directory, callback);
  }
}

/**
 * The storage directory path.
 * @type {string}
 */
FsKeyValue.prototype.directory = undefined;

/**
 * Path to the directory lock file.
 * @type {string}
 */
FsKeyValue.prototype.directoryLock = undefined;

/**
 * Initialize the store with a directory.
 *
 * Creates the directory if it doesn't exist.
 *
 * @param {string} directory - Path to storage directory
 * @param {OpenCallback} [callback] - Called when initialization completes
 */
FsKeyValue.prototype.open = function (directory, callback) {
  toCallback(this.openAsync(directory), callback, () => [null, this]);
};

/**
 * Initialize the store with a directory (async version).
 *
 * Creates the directory if it doesn't exist.
 *
 * @param {string} directory - Path to storage directory
 * @returns {Promise<void>}
 */
FsKeyValue.prototype.openAsync = async function (directory) {
  const exists = fs.existsSync(directory);
  if (!exists) {
    await fsp.mkdir(directory, { mode: 0o777 });
  }
  this.directory = directory;
  this.directoryLock = path.join(directory, '.lock');
};

/**
 * Retrieve a value by key.
 *
 * Uses a shared lock on the key file for safe concurrent reads.
 *
 * @param {string} key - The key to retrieve
 * @param {GetCallback} [callback] - Called with the value or undefined if not found
 */
FsKeyValue.prototype.get = function (key, callback) {
  // Missing keys fire callback() with no args, so err === undefined (not null).
  toCallback(this.getAsync(key), callback, (value) =>
    value === undefined ? [] : [null, value]
  );
};

/**
 * Retrieve a value by key (async version).
 *
 * Uses a shared lock on the key file for safe concurrent reads.
 *
 * @param {string} key - The key to retrieve
 * @returns {Promise<*>} The value, or undefined if key doesn't exist
 */
FsKeyValue.prototype.getAsync = async function (key) {
  const filename = path.join(this.directory, key);

  return withDirectoryLock(this.directoryLock, 'sh', async () => {
    if (!fs.existsSync(filename)) {
      return undefined;
    }
    return withKeyLock(filename, 'sh', async () => {
      const data = await fsp.readFile(filename, { encoding: 'utf8' });
      return JSON.parse(data);
    });
  });
};

/**
 * Store a value by key.
 *
 * Uses an exclusive lock on the key file for safe writes.
 * The value is serialized to JSON.
 *
 * @param {string} key - The key to store
 * @param {*} value - The value to store (must be JSON-serializable)
 * @param {ErrorCallback} [callback] - Called when write completes
 */
FsKeyValue.prototype.put = function (key, value, callback) {
  toCallback(this.putAsync(key, value), callback);
};

/**
 * Store a value by key (async version).
 *
 * Uses an exclusive lock on the key file for safe writes.
 * The value is serialized to JSON.
 *
 * @param {string} key - The key to store
 * @param {*} value - The value to store (must be JSON-serializable)
 * @returns {Promise<void>}
 */
FsKeyValue.prototype.putAsync = async function (key, value) {
  const filename = path.join(this.directory, key);

  return withDirectoryLock(this.directoryLock, 'sh', () =>
    withKeyLock(filename, 'ex', () =>
      fsp.writeFile(filename, JSON.stringify(value), { encoding: 'utf8' })
    )
  );
};

/**
 * Delete a key from the store.
 *
 * Uses an exclusive lock on the directory for safe deletion.
 * Does nothing if the key doesn't exist.
 *
 * @param {string} key - The key to delete
 * @param {ErrorCallback} [callback] - Called when deletion completes
 */
FsKeyValue.prototype.delete = function (key, callback) {
  toCallback(this.deleteAsync(key), callback);
};

/**
 * Delete a key from the store (async version).
 *
 * Uses an exclusive lock on the directory for safe deletion.
 * Does nothing if the key doesn't exist.
 *
 * @param {string} key - The key to delete
 * @returns {Promise<void>}
 */
FsKeyValue.prototype.deleteAsync = async function (key) {
  const filename = path.join(this.directory, key);

  return withDirectoryLock(this.directoryLock, 'ex', async () => {
    if (fs.existsSync(filename)) {
      await fsp.unlink(filename);
    }
  });
};

module.exports = FsKeyValue;
