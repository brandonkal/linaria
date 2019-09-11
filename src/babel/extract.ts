/* eslint-disable no-param-reassign */

import { types as t, PluginObj } from '@babel/core';
import { NodePath } from '@babel/traverse';
import debug from 'debug';
import evaluate from './evaluate/evaluate';
import addPrevalExport from './evaluate/addPrevalExport';
import getTemplateProcessor from './evaluate/templateProcessor';
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
import generateReplaceMap from './evaluate/generateReplaceMap';
import buildCSS from './utils/buildCSS';

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
          if (path.getSource().includes('__linariaPreval')) {
            return;
          }
          // Collect all the style rules from the styles we encounter
          state.queue = [];
          state.rules = {};
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

          const valueStrings: ValueStrings = new Map();
          const nodePathFromString = new Map<string, NodePath<t.Expression>>();

          const lazyDepsPaths = state.queue.reduce(
            (acc, { expressionValues: values }) => {
              acc.push(...values.filter(isLazyValue).map(v => v.ex));
              return acc;
            },
            [] as NodePath<t.Expression>[]
          );
          const lazyDeps = lazyDepsPaths.map(v => v.node);

          lazyDepsPaths.forEach((key, idx) => {
            valueStrings.set(key, `LINARIA_PREVAL_${idx}`);
            nodePathFromString.set(`LINARIA_PREVAL_${idx}`, key);
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

            state.dependencies.push(...evaluation.dependencies);
            lazyValues = evaluation.value.__linariaPreval;
          }

          // TODO: save CSS for later visits. If CSS saved for filename, ignore in processTemplate.
          if (!options._isEvaluatePass) {
            // Remove __linariaPreval constant from the program.
            const body = path.get('body');
            body.forEach(statement => {
              if (nodesAdded.some(node => node === statement.node)) {
                statement.remove();
              }
            });
            const replacer = generateReplaceMap(lazyValues, nodePathFromString);
            state.cssText = buildCSS(state.rules, replacer);
          }
        },
        exit(_, state) {
          log(`exiting ${state.file.opts.filename}`);
          if (Object.keys(state.rules).length) {
            // Store the result as the file metadata
            state.file.metadata = {
              linaria: {
                cssText: state.cssText,
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
