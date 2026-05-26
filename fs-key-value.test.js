'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FsKeyValue = require('./fs-key-value.js');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Clean up the fixtures directory before and after tests.
 */
function cleanFixtures() {
  if (fs.existsSync(FIXTURES_DIR)) {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

test.before(() => {
  cleanFixtures();
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
});

test.after(() => {
  cleanFixtures();
});

test('FsKeyValue constructor without directory creates empty instance', (t, done) => {
  const store = new FsKeyValue();
  assert.strictEqual(store.directory, undefined);
  assert.strictEqual(store.directoryLock, undefined);
  done();
});

test('open creates directory if it does not exist', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'open-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);
    assert.ok(db instanceof FsKeyValue);
    assert.strictEqual(db.directory, dir);
    assert.ok(fs.existsSync(dir));
    done();
  });
});

test('open works with existing directory', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'existing-dir');
  fs.mkdirSync(dir, { recursive: true });

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);
    assert.strictEqual(db.directory, dir);
    done();
  });
});

test('put stores a value and get retrieves it', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'put-get-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    const testValue = { foo: 'bar', num: 42 };

    db.put('testkey', testValue, (err) => {
      assert.strictEqual(err, null);

      db.get('testkey', (err, value) => {
        assert.strictEqual(err, null);
        assert.deepStrictEqual(value, testValue);
        done();
      });
    });
  });
});

test('put overwrites existing value', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'overwrite-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    db.put('key1', 'first', (err) => {
      assert.strictEqual(err, null);

      db.put('key1', 'second', (err) => {
        assert.strictEqual(err, null);

        db.get('key1', (err, value) => {
          assert.strictEqual(err, null);
          assert.strictEqual(value, 'second');
          done();
        });
      });
    });
  });
});

test('get returns undefined for non-existent key', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'missing-key-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    db.get('nonexistent', (err, value) => {
      assert.strictEqual(err, undefined);
      assert.strictEqual(value, undefined);
      done();
    });
  });
});

test('delete removes a key', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'delete-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    db.put('todelete', 'value', (err) => {
      assert.strictEqual(err, null);

      db.delete('todelete', (err) => {
        assert.strictEqual(err, null);

        db.get('todelete', (err, value) => {
          assert.strictEqual(value, undefined);
          done();
        });
      });
    });
  });
});

test('delete does nothing for non-existent key', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'delete-missing-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    db.delete('nosuchkey', (err) => {
      assert.strictEqual(err, null);
      done();
    });
  });
});

test('stores different value types', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'types-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    const values = {
      string: 'hello world',
      number: 12345,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      object: { nested: { deep: true } },
    };

    let remaining = Object.keys(values).length;

    for (const [key, expected] of Object.entries(values)) {
      db.put(key, expected, (err) => {
        assert.strictEqual(err, null);

        db.get(key, (err, value) => {
          assert.strictEqual(err, null);
          assert.deepStrictEqual(value, expected);
          remaining--;
          if (remaining === 0) {
            done();
          }
        });
      });
    }
  });
});

test('handles special characters in keys', (t, done) => {
  const dir = path.join(FIXTURES_DIR, 'special-chars-test');

  new FsKeyValue(dir, (err, db) => {
    assert.strictEqual(err, null);

    const key = 'key-with-dashes_and_underscores.and.dots';
    const value = 'special';

    db.put(key, value, (err) => {
      assert.strictEqual(err, null);

      db.get(key, (err, retrieved) => {
        assert.strictEqual(err, null);
        assert.strictEqual(retrieved, value);
        done();
      });
    });
  });
});
