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
            // a[idx] = key;
          });

          log(`found ${lazyDeps.length} lazy deps`);
          let valueNode;
          if (lazyDeps.length) {
            // push all lazyDeps into the program. These are required for the shaker and evaluation.
            // After evaluation, they are removed.
            valueNode = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('__linariaValues'),
                t.arrayExpression(lazyDeps)
              ),
            ]);
            path.node.body.push(valueNode);
          }

          log(
            `processing ${state.queue.length} items ${state.file.opts.filename}`
          );
          state.queue.forEach(item =>
            processTemplate(item, state, valueStrings)
          );

          let lazyValues: Value[] = [];

          // TODO: always shake if evaluating
          if (lazyDeps.length || options._isEvaluatePass) {
            // TEMP: show code before shake
            // eslint-disable-next-line
            const { code: codeBeforeShake } = generator(path.node);
            // TODO: don't generate seperate AST if preval pass?
            const [shaken] = shake(path.node, lazyDeps);
            log(`evaluating shaken ${state.file.opts.filename} for lazy deps`);
            // TODO: don't evaluate here if evaluate pass, the module system handles that.
            const evaluation = evaluate(
              shaken,
              state.file.opts.filename,
              options
            );

            state.dependencies.push(...evaluation.dependencies);
            lazyValues = evaluation.value.__linariaPreval;

            // Remove the __linariaValues constant from the program.
            if (path.node.body[path.node.body.length - 1] === valueNode) {
              path.node.body.pop();
            }
          }

          // TODO: save CSS for later visits. If CSS saved for filename, ignore in processTemplate.
          const replacer = generateReplaceMap(lazyValues, nodePathFromString);
          state.cssText = buildCSS(state.rules, replacer);
        },
        exit(_: any, state: State) {
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
