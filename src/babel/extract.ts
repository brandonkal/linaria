/* eslint-disable no-param-reassign */

import { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import getTemplateProcessor from './evaluate/templateProcessor';
import shake from './evaluate/shaker';
import evaluate from './evaluate/evaluate';
import debug from 'debug';
import generator from '@babel/generator';
const log = debug('linaria:babel');
import {
  State,
  StrictOptions,
  LazyValue,
  ExpressionValue,
  ValueType,
  ValueCache,
} from './types';
import TaggedTemplateExpression from './visitors/TaggedTemplateExpression';

function isLazyValue(v: ExpressionValue): v is LazyValue {
  return v.kind === ValueType.LAZY;
}

function isNodePath(obj: any): obj is NodePath {
  return obj && obj.node !== undefined;
}

// NOTE: used and imported by index.ts
export default function extract(_babel: any, options: StrictOptions) {
  const processTemplate = getTemplateProcessor(options);

  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          // Collect all the style rules from the styles we encounter
          state.queue = [];
          state.rules = {};
          state.index = -1;
          state.dependencies = [];
          state.replacements = [];

          log('traversing file');

          // We need our transforms to run before anything else
          // So we traverse here instead of a in a visitor
          path.traverse({
            TaggedTemplateExpression: p =>
              TaggedTemplateExpression(p, state, options),
          });

          const lazyDeps = state.queue.reduce(
            (acc, { expressionValues: values }) => {
              acc.push(
                ...values
                  .filter(isLazyValue)
                  .map(v => (isNodePath(v.ex) ? v.ex.node : v.ex))
              );
              return acc;
            },
            [] as (t.Expression | string)[]
          );

          log(`found ${lazyDeps.length} lazy deps`);

          let lazyValues: any[] = [];
          if (lazyDeps.length) {
            const [shaken] = shake(path.node, lazyDeps);
            log(`evaluating shaken ${state.file.opts.filename} for lazy deps`);
            const { code } = generator(shaken);
            const evaluation = evaluate(
              code,
              state.file.opts.filename,
              options
            );

            state.dependencies.push(...evaluation.dependencies);
            lazyValues = evaluation.value.__linariaPreval;
          }

          const valueCache: ValueCache = new Map();
          lazyDeps.forEach((key, idx) => valueCache.set(key, lazyValues[idx]));
          log(
            `processing ${state.queue.length} items ${state.file.opts.filename}`
          );
          state.queue.forEach(item => processTemplate(item, state, valueCache));
        },
        exit(_: any, state: State) {
          log(`exiting ${state.file.opts.filename}`);
          if (Object.keys(state.rules).length) {
            // Store the result as the file metadata
            state.file.metadata = {
              linaria: {
                rules: state.rules,
                replacements: state.replacements,
                dependencies: state.dependencies,
              },
            };
          }
        },
      },
    },
  };
}
