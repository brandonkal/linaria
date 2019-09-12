/* istanbul ignore file */

/**
 * A dummy module for preval. Allows the code to travel a bit farther before an error is thrown due to the use of an unsupported module.
 */

const o = () => {};
const obj = {};
const p = new Proxy(o, {
  get() {
    return () => {
      return obj;
    };
  },
  apply() {
    return obj;
  },
  set() {
    return true;
  },
});
export default p;
