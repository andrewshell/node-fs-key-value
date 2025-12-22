# fs-key-value

[![npm version](https://img.shields.io/npm/v/fs-key-value.svg)](https://www.npmjs.com/package/fs-key-value)
[![CI](https://github.com/andrewshell/node-fs-key-value/actions/workflows/ci.yml/badge.svg)](https://github.com/andrewshell/node-fs-key-value/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A simple key-value data store using only the filesystem. Uses POSIX file locking for safe operation in multi-process environments without the overhead of a separate database server.

## Features

- Simple key-value API (`get`, `put`, `delete`)
- Both callback and async/await interfaces
- File-based storage (values stored as JSON)
- POSIX file locking for safe concurrent access
- Works across multiple processes (via cluster, child_process, etc.)
- No external database required

## Requirements

- Node.js >= 18.0.0
- POSIX-compliant filesystem (Linux, macOS, etc.)

## Installation

```bash
npm install fs-key-value
```

## Quick Start

### Using async/await

```js
const FsKeyValue = require('fs-key-value');

const db = new FsKeyValue();
await db.openAsync('./mydb');

// Store a value
await db.putAsync('user:1', { name: 'Alice', age: 30 });

// Retrieve the value
const data = await db.getAsync('user:1');
console.log(data); // { name: 'Alice', age: 30 }

// Delete the value
await db.deleteAsync('user:1');
```

### Using callbacks

```js
var FsKeyValue = require('fs-key-value');

var db = new FsKeyValue('./mydb', function (err, db) {
  if (err) throw err;

  // Store a value
  db.put('user:1', { name: 'Alice', age: 30 }, function (err) {
    if (err) throw err;

    // Retrieve the value
    db.get('user:1', function (err, data) {
      if (err) throw err;
      console.log(data); // { name: 'Alice', age: 30 }

      // Delete the value
      db.delete('user:1', function (err) {
        if (err) throw err;
        console.log('Deleted!');
      });
    });
  });
});
```

## API

### `new FsKeyValue([directory], [callback])`

Creates a new key-value store instance.

- `directory` (string, optional): Path to the storage directory
- `callback` (function, optional): Called with `(err, db)` when initialization completes

### `db.open(directory, callback)`

Initialize or reinitialize the store with a directory. Creates the directory if it doesn't exist.

- `directory` (string): Path to the storage directory
- `callback` (function): Called with `(err, db)` when complete

### `db.get(key, callback)`

Retrieve a value by key.

- `key` (string): The key to retrieve
- `callback` (function): Called with `(err, value)`. Value is `undefined` if key doesn't exist.

### `db.put(key, value, callback)`

Store a value. The value is serialized to JSON.

- `key` (string): The key to store
- `value` (any): Any JSON-serializable value
- `callback` (function): Called with `(err)` when complete

### `db.delete(key, callback)`

Delete a key from the store.

- `key` (string): The key to delete
- `callback` (function): Called with `(err)` when complete

### Async Methods

All methods are also available as async/Promise versions:

- `db.openAsync(directory)` → `Promise<void>`
- `db.getAsync(key)` → `Promise<value | undefined>`
- `db.putAsync(key, value)` → `Promise<void>`
- `db.deleteAsync(key)` → `Promise<void>`

## Multi-Process Example

This example demonstrates safe concurrent access from multiple worker processes:

```js
var cluster = require('cluster');
var FsKeyValue = require('fs-key-value');

if (cluster.isMaster) {
  // Fork 8 worker processes
  for (var i = 0; i < 8; i++) {
    cluster.fork();
  }
} else {
  var id = cluster.worker.id % 2;

  var mydb = new FsKeyValue('./mydb', function (err, db) {
    if (err) {
      return console.log(err);
    }

    db.put(
      'hoopla' + id,
      { msg: 'ballyhoo ' + cluster.worker.id },
      function (err) {
        if (err) {
          return console.log(cluster.worker.id + ' err ' + err);
        }

        db.get('hoopla' + id, function (err, data) {
          if (err) {
            return console.log(cluster.worker.id + ' err ' + err);
          }

          if (data != undefined) {
            console.log(data.msg);
          }

          db.delete('hoopla' + id);
          cluster.worker.kill();
        });
      }
    );
  });
}
```

## How It Works

- Each key is stored as a separate file in the specified directory
- Values are serialized as JSON
- Uses `fs-ext` for POSIX file locking (`flock`)
- Shared locks for reads, exclusive locks for writes
- Directory-level lock file (`.lock`) coordinates operations

## License

MIT
