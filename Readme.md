# fs-key-value

This module provides a simple key value data store using only the file system. It makes use of file locking to allow safe operation in a multiple process environment without the overhead of a separate database server.

[![NPM](https://nodei.co/npm/fs-key-value.png)](https://nodei.co/npm/fs-key-value/)

## Installation

```bash
$ npm install fs-key-value
```

## Example

```js
var cluster = require('cluster'),
    FsKeyValue = require('fs-key-value')

if (cluster.isMaster) {
  for (var i = 0; i < 8; i++) {
    cluster.fork()
  }
} else {
  var id = cluster.worker.id % 2

  var mydb = new FsKeyValue('./mydb', function (err, db) {
    if (err) {
      return console.log(err)
    }

    db.put('hoopla' + id, {'msg': 'ballyhoo ' + cluster.worker.id}, function (err) {
      if (err) {
        return console.log(cluster.worker.id + ' err ' + err)
      }

      db.get('hoopla' + id, function (err, data) {
        if (err) {
          return console.log(cluster.worker.id + ' err ' + err)
        }

        if (data != undefined) {
          console.log(data.msg)
        }

        db.delete('hoopla' + id)

        cluster.worker.kill()
      })
    })
  })
}
```
