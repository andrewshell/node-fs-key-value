'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const fsExt = require('fs-ext');
const path = require('path');
const { promisify } = require('util');

const flock = promisify(fsExt.flock);

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
  if (typeof callback !== 'function') {
    callback = function (err) {
      if (err) {
        throw err;
      }
    };
  }

  this.openAsync(directory)
    .then(() => callback(null, this))
    .catch((err) => callback(err));
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
  if (typeof callback !== 'function') {
    callback = function (err) {
      if (err) {
        throw err;
      }
    };
  }

  this.getAsync(key)
    .then((value) => {
      if (value === undefined) {
        // Preserve original behavior: callback() with no args for missing keys
        callback();
      } else {
        callback(null, value);
      }
    })
    .catch((err) => callback(err));
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
  let dirlock = null;
  let keyfile = null;

  try {
    // Open and lock directory
    dirlock = fs.openSync(this.directoryLock, 'a', 0o666);
    await flock(dirlock, 'sh');

    // Check if key exists
    const exists = fs.existsSync(filename);
    if (!exists) {
      return undefined;
    }

    // Open and lock key file
    keyfile = fs.openSync(filename, 'a+', 0o666);
    await flock(keyfile, 'sh');

    // Read value
    const data = await fsp.readFile(filename, { encoding: 'utf8' });
    return JSON.parse(data);
  } finally {
    // Release locks and close files
    if (keyfile !== null) {
      try {
        await flock(keyfile, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(keyfile);
      } catch {
        /* ignore */
      }
    }
    if (dirlock !== null) {
      try {
        await flock(dirlock, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(dirlock);
      } catch {
        /* ignore */
      }
    }
  }
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
  if (typeof callback !== 'function') {
    callback = function (err) {
      if (err) {
        throw err;
      }
    };
  }

  this.putAsync(key, value)
    .then(() => callback(null))
    .catch((err) => callback(err));
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
  let dirlock = null;
  let keyfile = null;

  try {
    // Open and lock directory (shared lock for puts)
    dirlock = fs.openSync(this.directoryLock, 'a', 0o666);
    await flock(dirlock, 'sh');

    // Open and lock key file (exclusive lock for write)
    keyfile = fs.openSync(filename, 'a', 0o666);
    await flock(keyfile, 'ex');

    // Write value
    await fsp.writeFile(filename, JSON.stringify(value), { encoding: 'utf8' });
  } finally {
    // Release locks and close files
    if (keyfile !== null) {
      try {
        await flock(keyfile, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(keyfile);
      } catch {
        /* ignore */
      }
    }
    if (dirlock !== null) {
      try {
        await flock(dirlock, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(dirlock);
      } catch {
        /* ignore */
      }
    }
  }
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
  if (typeof callback !== 'function') {
    callback = function (err) {
      if (err) {
        throw err;
      }
    };
  }

  this.deleteAsync(key)
    .then(() => callback(null))
    .catch((err) => callback(err));
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
  let dirlock = null;

  try {
    // Open and lock directory (exclusive lock for delete)
    dirlock = fs.openSync(this.directoryLock, 'a', 0o666);
    await flock(dirlock, 'ex');

    // Delete if exists
    const exists = fs.existsSync(filename);
    if (exists) {
      await fsp.unlink(filename);
    }
  } finally {
    // Release lock and close file
    if (dirlock !== null) {
      try {
        await flock(dirlock, 'un');
      } catch {
        /* ignore */
      }
      try {
        fs.closeSync(dirlock);
      } catch {
        /* ignore */
      }
    }
  }
};

module.exports = FsKeyValue;
