/*
 * This wrapper is needed to turn any object to the localStorage-like API.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Storage#Methods
 *
 * Primarily, this wrapper is needed to turn a Cookies object from a
 * server request to a localStorage-like API for interoperability
 * during Server Side Rendering.
 */
export class StorageWrapper {
  // @todo StorageEvent

  // @todo find a way to set length if a properties sets manually

  length: number;

  constructor(o: Object = { }) {    
    Object.defineProperty(this, 'length', Object.getOwnPropertyDescriptor(Array, 'length'));
    
    for (let k in o) {
      this.setItem(k, o[k]);
    }
  }

  key(index: number) {
    let keys = Object.keys(this);
    
    let key = keys[index]

    return (key) ? key : null;
  }
  
  getItem(key) {
    let item = this[key];

    return (item) ? item : null;
  }
  
  setItem(key, value) {
    this[key] = value;
    
    Object.defineProperty(this, 'length', { value: Object.keys(this).length });
  }
  
  removeItem(key) {
    delete this[key];
    
    Object.defineProperty(this, 'length', { value: Object.keys(this).length });

    return void(0); //somewhy it's should return Void https://developer.mozilla.org/en-US/docs/Web/API/Storage/removeItem#Return_value
  }
  
  clear() {
    for (let key in this) {
      delete this[key];
    }
    
    Object.defineProperty(this, 'length', { value: Object.keys(this).length });
  }
}