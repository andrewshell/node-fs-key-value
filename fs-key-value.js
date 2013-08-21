var fs = require('fs-ext'),
    path = require('path'),
    util = require('util'),
    Step = require('step')

function FsKeyValue (directory, callback) {
  this.open(directory, callback)
}

FsKeyValue.prototype.open = function (directory, callback) {
  var self = this

  if (typeof callback != 'function') {
    var callback = function (err) { 
      if (err) {
        throw err
      }
    }
  }

  Step(
    function initialize () {
      fs.exists(directory, this)
    },
    function makeDirectoryIfNotExists (exists) {
      if (exists) {
        return this()
      } else {
        fs.mkdir(directory, 0777, this)
      }
    },
    function openDirectoryLockFile (err) {
      if (err) {
        return callback(err)
      }
      var filename = path.join(directory, '.lock')
      fs.open(filename, 'a', 0666, this)
    },
    function assignDirectoryLockFile (err, fd) {
      if (err) {
        return callback(err)
      }
      self.lock = fd
      this()
    },
    function finishInitialization() {
      self.directory = directory
      callback(null, self)
    }
  )
}

FsKeyValue.prototype.get = function (key, callback) {
  var self = this

  if (typeof callback != 'function') {
    var callback = function (err) { 
      if (err) {
        throw err
      }
    }
  }

  var filename
  var keyfile
  var value

  Step(
    function getDirectorySharedLock () {
      fs.flock(self.lock, 'sh', this)
    },
    function doesKeyFileExist (err) {
      if (err) {
        return callback(err)
      }
      filename = path.join(self.directory, key)
      fs.exists(filename, this)
    },
    function openKeyFile (exists) {
      if (exists) {
        fs.open(filename, 'a+', 0666, this)
      } else {
        callback()
      }
    },
    function getKeyFileSharedLock (err, fd) {
      if (err) {
        return callback(err)
      }
      keyfile = fd
      fs.flock(keyfile, 'sh', this)
    },
    function readKeyFile (err) {
      if (err) {
        return callback(err)
      }
      fs.readFile(filename, {'encoding': 'utf8'}, this)
    },
    function recordKeyValue (err, data) {
      if (err) {
        return callback(err)
      }
      value = data
      this()
    },
    function releaseKeyFileSharedLock () {
      fs.flock(keyfile, 'un', this)
    },
    function releaseDirectorySharedLock (err) {
      if (err) {
        return callback(err)
      }
      fs.flock(self.lock, 'un', this)
    },
    function finishGettingKey (err) {
      if (err) {
        return callback(err)
      }
      callback(err, JSON.parse(value))
    }
  )
}

FsKeyValue.prototype.put = function (key, value, callback) {
  var self = this

  if (typeof callback != 'function') {
    var callback = function (err) { 
      if (err) {
        throw err
      }
    }
  }

  var filename;
  var keyfile;
  var value;

  Step(
    function getDirectorySharedLock () {
      fs.flock(self.lock, 'sh', this)
    },
    function openKeyFile (err) {
      if (err) {
        return callback(err)
      }
      filename = path.join(self.directory, key)
      fs.open(filename, 'a', 0666, this)
    },
    function getKeyFileExclusiveLock (err, fd) {
      if (err) {
        return callback(err)
      }
      keyfile = fd
      fs.flock(keyfile, 'ex', this)
    },
    function writeKeyFile (err) {
      if (err) {
        return callback(err)
      }
      fs.writeFile(filename, JSON.stringify(value), {'encoding': 'utf8'}, this)
    },
    function releaseKeyFileSharedLock (err) {
      if (err) {
        return callback(err)
      }
      fs.flock(keyfile, 'un', this)
    },
    function releaseDirectorySharedLock (err) {
      if (err) {
        return callback(err)
      }
      fs.flock(self.lock, 'un', this)
    },
    function finishPuttingKey (err) {
      return callback(err)
    }
  )
}

FsKeyValue.prototype.delete = function (key, callback) {
  var self = this

  if (typeof callback != 'function') {
    var callback = function (err) { 
      if (err) {
        throw err
      }
    }
  }

  var filename;
  var keyfile;
  var value;

  Step(
    function getDirectoryExclusiveLock () {
      fs.flock(self.lock, 'ex', this)
    },
    function doesKeyFileExist (err) {
      if (err) {
        return callback(err)
      }
      filename = path.join(self.directory, key)
      fs.exists(filename, this)
    },
    function deleteKeyFile (exists) {
      if (exists) {
        fs.unlink(filename, this)
      } else {
        return callback()
      }
    },
    function releaseDirectorySharedLock (err) {
      if (err) {
        return callback(err)
      }
      fs.flock(self.lock, 'un', this)
    },
    function finishDeletingKey (err) {
      return callback(err)
    }
  )
}

module.exports = FsKeyValue