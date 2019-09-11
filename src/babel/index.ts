import loadOptions, { PluginOptions } from '../utils/loadOptions';
import extract from './extract';

export default function linaria(context: any, options: PluginOptions) {
  return {
    plugins: [[extract, loadOptions(options)]],
  };
}
