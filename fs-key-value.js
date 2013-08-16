var fs = require('fs-ext')
var path = require('path')

function FsKeyValue (directory) {
  this.directory = directory
  if (!fs.existsSync(this.directory)) {
    fs.mkdirSync(this.directory)
  }
  var filename = path.join(this.directory, '.lock')
  this.lock = fs.openSync(filename, 'a')
}

FsKeyValue.prototype.get = function (key) {
  fs.flockSync(this.lock, 'sh')
  var filename = path.join(this.directory, key)
  if (!fs.existsSync(filename)) {
    return
  }
  var fd = fs.openSync(filename, 'a+')
  fs.flockSync(fd, 'sh')
  var data = fs.readFileSync(filename, {'encoding': 'utf8'})
  fs.flockSync(fd, 'un')
  fs.flockSync(this.lock, 'un')
  return JSON.parse(data)
}

FsKeyValue.prototype.put = function (key, value) {
  fs.flockSync(this.lock, 'sh')
  var filename = path.join(this.directory, key)
  var fd = fs.openSync(filename, 'a')
  fs.flockSync(fd, 'ex')
  fs.writeFileSync(filename, JSON.stringify(value), {'encoding': 'utf8'})
  fs.flockSync(fd, 'un')
  fs.flockSync(this.lock, 'un')
};

FsKeyValue.prototype.del = function (key) {
  fs.flockSync(this.lock, 'ex')
  var filename = path.join(this.directory, key)
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename)
  }
  fs.flockSync(this.lock, 'un')
};

module.exports = FsKeyValue