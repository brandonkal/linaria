/* eslint-disable no-param-reassign */

import { types as t, PluginObj } from '@babel/core';
import { NodePath } from '@babel/traverse';
import debug from 'debug';
import evaluate from './evaluate/evaluate';
import addPrevalExport from './evaluate/addPrevalExport';
import getTemplateProcessor from './evaluate/templateProcessor';
import Module from './module';
const log = debug('linaria:babel');
import {
  State,
  StrictOptions,
  ValueStrings,
  LazyValue,
  ExpressionValue,
  ValueType,
  Value,
} from './types';
import TaggedTemplateExpression from './visitors/TaggedTemplateExpression';
import generateReplaceMap from './utils/generateReplaceMap';
import { processInterpolations } from './utils/processInterpolations';
import { merge } from './utils/errorQueue';
import SimpleNode from './utils/SimpleNode';
import { writeAndFlushConsole } from './console';

function isLazyValue(v: ExpressionValue): v is LazyValue {
  return v.kind === ValueType.LAZY;
}

// NOTE: used and imported by index.ts
export default function extract(
  _babel: any,
  options: StrictOptions
): PluginObj<State> {
  const processTemplate = getTemplateProcessor(options);

  return {
    name: 'linaria',
    visitor: {
      Program: {
        enter(path, state) {
          const src = path.getSource();
          if (src.includes('__linariaPreval')) {
            return;
          }
          // Collect all the style rules from the styles we encounter
          state.queue = [];
          state.rules = [];
          state.index = -1;
          state.dependencies = [];
          state.replacements = [];

          log('traversing file');

          // We need our transforms to run before anything else
          // So we traverse here instead of in a visitor
          path.traverse({
            TaggedTemplateExpression: p =>
              TaggedTemplateExpression(p, state, options),
          });

          const valueStrings: ValueStrings = new WeakMap();
          const nodePathFromString = new Map<string, SimpleNode>();

          const lazyDepsPaths = state.queue.reduce(
            (acc, { expressionValues: values }) => {
              acc.push(...values.filter(isLazyValue).map(v => v.ex));
              return acc;
            },
            [] as NodePath<t.Expression>[]
          );
          const lazyDeps = lazyDepsPaths.map(v => v.node);

          lazyDepsPaths.forEach((nodePath, idx) => {
            valueStrings.set(nodePath, `LINARIA_PREVAL_${idx}`);
            nodePathFromString.set(
              `LINARIA_PREVAL_${idx}`,
              new SimpleNode(nodePath, state.file.opts.filename, src)
            );
          });

          log(`found ${lazyDeps.length} lazy deps`);
          // push all lazyDeps into the program. Required for all source files.
          const nodesAdded = addPrevalExport(lazyDeps, path.node);

          log(
            `processing ${state.queue.length} items ${state.file.opts.filename}`
          );

          state.queue.forEach(item =>
            processTemplate(item, state, valueStrings)
          );

          let lazyValues: Value[] = [];

          if (lazyDeps.length && !options._isEvaluatePass) {
            log(`evaluating ${state.file.opts.filename} for lazy deps`);
            const evaluation = evaluate(
              path,
              state.file.opts.filename,
              options
            );

            state.dependencies = [...evaluation.dependencies];
            lazyValues = evaluation.value.__linariaPreval;
            if (lazyValues == null || lazyDeps.length !== lazyValues.length) {
              writeAndFlushConsole();
              Module.invalidateAll();
              throw merge(
                new Error(
                  'Linaria Internal Error: lazy evaluation count is incorrect.\nIf no other errors were thrown, this is likely caused by using different babel transforms in evaluation and main compilation.'
                )
              );
            }
          }

          let replacer;
          if (!options._isEvaluatePass) {
            // Remove __linariaPreval constant from the program.
            const body = path.get('body');
            body.forEach(statement => {
              if (nodesAdded.some(node => node === statement.node)) {
                statement.remove();
              }
            });
            replacer = generateReplaceMap(lazyValues, nodePathFromString);
            processInterpolations(state.rules, replacer, options.evaluate);
          }
          state.replacer = replacer;
        },
        exit(_, state) {
          log(`exiting ${state.file.opts.filename}`);
          if (
            typeof state.rules === 'object' &&
            Object.keys(state.rules).length
          ) {
            // Store the result as the file metadata
            state.file.metadata = {
              linaria: {
                rules: state.rules.map(rule => {
                  delete rule.props;
                  delete rule.displayName;
                  delete rule.interpolations;
                  return rule;
                }),
                replacer: state.replacer,
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
