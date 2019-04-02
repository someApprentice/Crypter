import { StorageWrapper } from  './StorageWrapper';

describe('StorageWrapper', () => {
  let storage: StorageWrapper;

  beforeEach(() => {
    storage = new StorageWrapper();
  })

  it("should return the name of the nth key or null if key doesn't exist", () => {
    let n = 0;

    let items = {
      foo: "FOO",
      bar: "BAR",
      baz: "BAZ"
    }

    let key;

    for (let k in items) {
      storage.setItem(k, items[k]);

      key = storage.key(n);

      expect(key).toEqual(k);

      n++;
    }

    expect(storage.key(n)).toBeNull();
  });

  it("should return key's value or null if doesn't exist", () => {
    let value = "VALUE";

    let key = Object.keys(value)[0];

    storage.setItem(key, value);

    expect(storage.getItem(key)).toEqual(value);
    expect(storage[key]).toEqual(value)
    expect(storage.getItem('undefined')).toBeNull();
  });

  it("should set key's value and increase length", () => {
    let value = "VALUE";
    let key = Object.keys(value)[0];

    storage.setItem(key, value);
    expect(storage.getItem(key)).toEqual(value);
    expect(storage[key]).toEqual(value);

    value = "ANOTHER VALUE";

    storage.setItem(key, value);
    expect(storage.getItem(key)).toEqual(value);
    expect(storage[key]).toEqual(value);

    expect(storage.length).toBe(1);
  });

  it("should remove key's value and decrease length", () => {
    let value = "VALUE";
    let key = Object.keys(value)[0];

    storage.setItem(key, value);

    storage.removeItem(key);

    expect(storage.getItem(key)).toBeNull();
    expect(storage[key]).toBeUndefined();

    expect(storage.length).toBe(0);
  });

  it("should clear all keys of storage", () => {
    let items = {
      foo: "FOO",
      bar: "BAR",
      baz: "BAZ"
    }

    for (let k in items) {
      storage.setItem(k, items[k]);
    }

    storage.clear();

    expect(storage).toEqual((new StorageWrapper()));
  });
});