# fs-key-value

This module provides a simple key value data store using only the file system. It makes use of file locking to allow safe operation in a multiple process environment without the overhead of a separate database server.

[![NPM](https://nodei.co/npm/fs-key-value.png)](https://nodei.co/npm/fs-key-value/)

## Installation

```bash
$ npm install fs-key-value
```

## Example

```js
var FsKeyValue = new require('fs-key-value')

var db = new FsKeyValue('./mydb')

var cluster = require('cluster')

if (cluster.isMaster) {
  for (var i = 0; i < 8; i++) {
    cluster.fork()
  }
} else {
  var id = cluster.worker.id % 2

  db.put('hoopla' + id, {'msg': 'ballyhoo ' + cluster.worker.id})

  var data = db.get('hoopla' + id)
  if (data != undefined) {
    console.log(data.msg)
  }

  db.del('hoopla' + id)

  cluster.worker.kill()
}
```