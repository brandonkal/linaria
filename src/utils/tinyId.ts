import incstr from 'incstr';
import blacklist from './blacklist';

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

function valid(string: string) {
  if (/^[0-9]/.test(string)) {
    return false;
  }
  return !blacklist.some(word => string.includes(word));
}

interface factoryOptions {
  prefix?: string;
  suffix?: string;
  optimize: boolean;
}

export default function makeTinyId({
  prefix = '',
  suffix = '',
  optimize,
}: factoryOptions) {
  let map = new Map<string, string>();
  const next = incstr.idGenerator({ alphabet });

  function optimizer(string: string) {
    if (optimize) {
      if (map.has(string)) {
        return map.get(string);
      }

      let id: string;
      while (!valid((id = next()))) {
        // empty
      }
      map.set(string, id);
      return id;
    } else {
      return string;
    }
  }

  const api = function(string: string) {
    return `${prefix}${optimizer(string)}${suffix}`;
  };
  api.map = map;

  return api;
}
