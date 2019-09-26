import { StrictOptions } from '../babel/types';

export const schema = {
  type: 'object',
  properties: {
    displayName: {
      type: 'boolean',
    },
    evaluate: {
      type: 'boolean',
    },
    prefix: {
      type: 'string',
    },
    optimize: {
      type: 'boolean',
    },
    sourceMap: {
      type: 'boolean',
    },
    cacheDirectory: {
      type: 'string',
    },
    pluginOptions: {
      type: 'object',
    },
  },
};

export const defaultOptions: StrictOptions = {
  displayName: process.env.NODE_ENV !== 'production',
  evaluate: true,
  prefix: '',
  optimize: process.env.NODE_ENV === 'production',
  ignore: /node_modules/,
  _isEvaluatePass: false,
};
