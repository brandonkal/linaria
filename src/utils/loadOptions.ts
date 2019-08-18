import cosmiconfig from 'cosmiconfig';
import { StrictOptions } from '../babel/types';

export type PluginOptions = StrictOptions & {
  configFile?: string;
};

const explorer = cosmiconfig('@brandonkal/linaria');

export default function loadOptions(
  overrides: Partial<PluginOptions> = {}
): Partial<StrictOptions> {
  const { configFile, ...rest } = overrides;

  const result =
    configFile !== undefined
      ? explorer.loadSync(configFile)
      : explorer.searchSync();

  return {
    displayName: process.env.NODE_ENV !== 'production',
    evaluate: true,
    prefix: '',
    optimize: process.env.NODE_ENV === 'production',
    ignore: /node_modules/,
    ...(result ? result.config : null),
    ...rest,
  };
}
