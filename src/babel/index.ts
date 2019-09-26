import { StrictOptions } from './types';
import extract from './extract';

export default function linaria(context: any, options: StrictOptions) {
  return {
    plugins: [[extract, options]],
  };
}
