(function () {
    "use strict";

    var fs = require('fs-ext'),
        path = require('path'),
        step = require('step');

    function FsKeyValue(directory, callback) {
        this.open(directory, callback);
    }

    FsKeyValue.prototype.open = function (directory, callback) {
        var self = this;

        if (typeof callback !== 'function') {
            callback = function (err) {
                if (err) {
                    throw err;
                }
            };
        }

        step(
            function initialize() {
                fs.exists(directory, this);
            },
            function makeDirectoryIfNotExists(exists) {
                if (exists) {
                    return this();
                }
                fs.mkdir(directory, '0777', this);
            },
            function defineDirectoryAndLockFile(err) {
                if (err) {
                    return callback(err);
                }
                self.directory = directory;
                self.directoryLock = path.join(directory, '.lock');
                callback(null, self);
            }
        );
    };

    FsKeyValue.prototype.get = function (key, callback) {
        var self = this,
            filename,
            dirlock,
            keyfile,
            value;

        if (typeof callback !== 'function') {
            callback = function (err) {
                if (err) {
                    throw err;
                }
            };
        }

        step(
            function openDirectoryLock() {
                fs.open(self.directoryLock, 'a', '0666', this);
            },
            function getDirectorySharedLock(err, fd) {
                if (err) {
                    return callback(err);
                }
                dirlock = fd;
                fs.flock(dirlock, 'sh', this);
            },
            function doesKeyFileExist(err) {
                if (err) {
                    return callback(err);
                }
                filename = path.join(self.directory, key);
                fs.exists(filename, this);
            },
            function openKeyFile(exists) {
                if (exists) {
                    fs.open(filename, 'a+', '0666', this);
                } else {
                    callback();
                }
            },
            function getKeyFileSharedLock(err, fd) {
                if (err) {
                    return callback(err);
                }
                keyfile = fd;
                fs.flock(keyfile, 'sh', this);
            },
            function readKeyFile(err) {
                if (err) {
                    return callback(err);
                }
                fs.readFile(filename, {'encoding': 'utf8'}, this);
            },
            function recordKeyValue(err, data) {
                if (err) {
                    return callback(err);
                }
                value = data;
                this();
            },
            function releaseKeyFileSharedLock() {
                fs.flock(keyfile, 'un', this);
            },
            function closeKeyFile(err) {
                if (err) {
                    return callback(err);
                }
                fs.close(keyfile, this);
            },
            function releaseDirectorySharedLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.flock(dirlock, 'un', this);
            },
            function closeDirectoryLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.close(dirlock, this);
            },
            function finishGettingKey(err) {
                if (err) {
                    return callback(err);
                }
                callback(err, JSON.parse(value));
            }
        );
    };

    FsKeyValue.prototype.put = function (key, value, callback) {
        var self = this,
            dirlock,
            filename,
            keyfile;

        if (typeof callback !== 'function') {
            callback = function (err) {
                if (err) {
                    throw err;
                }
            };
        }

        step(
            function openDirectoryLock() {
                fs.open(self.directoryLock, 'a', '0666', this);
            },
            function getDirectorySharedLock(err, fd) {
                if (err) {
                    return callback(err);
                }
                dirlock = fd;
                fs.flock(dirlock, 'sh', this);
            },
            function openKeyFile(err) {
                if (err) {
                    return callback(err);
                }
                filename = path.join(self.directory, key);
                fs.open(filename, 'a', '0666', this);
            },
            function getKeyFileExclusiveLock(err, fd) {
                if (err) {
                    return callback(err);
                }
                keyfile = fd;
                fs.flock(keyfile, 'ex', this);
            },
            function writeKeyFile(err) {
                if (err) {
                    return callback(err);
                }
                fs.writeFile(filename, JSON.stringify(value), {'encoding': 'utf8'}, this);
            },
            function releaseKeyFileSharedLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.flock(keyfile, 'un', this);
            },
            function closeKeyFile(err) {
                if (err) {
                    return callback(err);
                }
                fs.close(keyfile, this);
            },
            function releaseDirectorySharedLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.flock(dirlock, 'un', this);
            },
            function closeDirectoryLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.close(dirlock, this);
            },
            function finishPuttingKey(err) {
                return callback(err);
            }
        );
    };

    FsKeyValue.prototype.delete = function (key, callback) {
        var self = this,
            dirlock,
            filename;

        if (typeof callback !== 'function') {
            callback = function (err) {
                if (err) {
                    throw err;
                }
            };
        }

        step(
            function openDirectoryLock() {
                fs.open(self.directoryLock, 'a', '0666', this);
            },
            function getDirectoryExclusiveLock(err, fd) {
                if (err) {
                    console.error("err:",err);
                    return callback(err);
                }
                dirlock = fd;
                fs.flock(dirlock, 'ex', this);
            },
            function doesKeyFileExist(err) {
                if (err) {
                    return callback(err);
                }
                filename = path.join(self.directory, key);
                fs.exists(filename, this);
            },
            function deleteKeyFile(exists) {
                if (exists) {
                    fs.unlink(filename, this);
                } else {
                    this();
                }
            },
            function releaseDirectorySharedLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.flock(dirlock, 'un', this);
            },
            function closeDirectoryLock(err) {
                if (err) {
                    return callback(err);
                }
                fs.close(dirlock, this);
            },
            function finishDeletingKey(err) {
                return callback(err);
            }
        );
    };

    module.exports = FsKeyValue;
}());
