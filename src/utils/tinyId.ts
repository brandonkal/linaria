import incstr from 'incstr';
import blacklist from './blacklist';

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

interface factoryOptions {
  prefix: string;
  optimize: boolean;
}

export default class TinyID {
  /** set to override the map property */
  record: Record<string, string> = {};
  /** register and get a tiny ID for a given string */
  get: (string: string) => string;
  /** resets the generator and map properties */
  reset: () => void;
  constructor({ prefix, optimize }: factoryOptions) {
    let next = incstr.idGenerator({ alphabet });
    const valid = (string: string) => {
      if (this.record.hasOwnProperty(string) || /^[0-9]/.test(string)) {
        return false;
      }
      return !blacklist.some(word => string.includes(word));
    };

    const optimizer = (string: string) => {
      if (optimize) {
        if (this.record.hasOwnProperty(string)) {
          return this.record[string];
        }

        let id: string;
        while (!valid((id = next()))) {
          // empty
        }
        return (this.record[string] = id);
      } else {
        return string;
      }
    };

    this.get = string => `${prefix}${optimizer(string)}`;
    this.reset = () => {
      next = incstr.idGenerator({ alphabet });
      this.record = {};
    };
  }
}
