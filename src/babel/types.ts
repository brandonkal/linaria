import { ElementType } from 'react';
import { types as t, TransformOptions } from '@babel/core';
import { NodePath } from '@babel/traverse';

export type JSONValue = string | number | boolean | JSONObject | JSONArray;

export interface JSONObject {
  [x: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

export type Serializable = JSONArray | JSONObject;

export type Styled = ElementType & {
  __linaria: {
    className: string;
    extends: ElementType | Styled;
  };
};

export enum ValueType {
  LAZY,
  RUNTIME,
  VALUE,
}

export type Value = Function | Styled | string | number | Serializable;

export type ValueStrings = WeakMap<NodePath<t.Expression>, string>;

export interface LazyValue {
  kind: ValueType.LAZY;
  ex: NodePath<t.Expression>;
}

export interface RuntimeValue {
  kind: ValueType.RUNTIME;
  ex: any;
}

export interface EvaluatedValue {
  kind: ValueType.VALUE;
  value: Value;
}

export type ExpressionValue = LazyValue | RuntimeValue | EvaluatedValue;

export interface TemplateExpression {
  styled?: {
    component: NodePath<t.Expression> | { node: t.StringLiteral };
  };
  path: NodePath<t.TaggedTemplateExpression>;
  expressionValues: ExpressionValue[];
  isGlobal: boolean;
}

export interface Replacement {
  original: { start: Location; end: Location };
  length: number;
}

export interface Interpolation {
  /** the id getter is composed of idPrefix + index */
  id: string;
  idPrefix: string;
  index: number;
  node: t.Expression;
  source: string;
  unit: string;
  inComment: boolean;
  isLazy: boolean;
  /* A string access key for lazy values */
  prevalKey?: string;
  /** set to true in buildCSS to signal that interpolation should be skipped. */
  shouldSkip?: boolean;
}

export interface RuleBase {
  className: string;
  cssText: string;
  start?: Location;
  isGlobal: boolean;
  /** keep track of strings that should be replaced. */
  prevalStrings: string[];
  /** set selectorWrap for wrapped styled components to evaluate a more specific selector. */
  selectorWrap?: string;
}

export interface Rule extends RuleBase {
  displayName: string;
  props: t.ObjectProperty[];
  interpolations: Interpolation[];
}

export interface CSSIdentifiers {
  classNames: string[];
  cssVars: string[];
  modifiers: string[];
}

export interface State {
  queue: TemplateExpression[];
  rules: Rule[];
  cssText: string;
  replacements: Replacement[];
  index: number;
  dependencies: string[];
  file: {
    opts: {
      cwd: string;
      root: string;
      filename: string;
      code: string;
    };
    metadata: {
      linaria: LinariaMetadata;
    };
  };
}

export interface LinariaMetadata {
  cssText: string;
  replacements: Replacement[];
  dependencies: string[];
}

export interface StrictOptions {
  displayName: boolean;
  evaluate: boolean;
  ignore: RegExp;
  prefix: string;
  optimize: boolean;
  babelOptions: TransformOptions;
  /** set to true when evaluating modules for preval. */
  _isEvaluatePass: boolean;
}

export interface Location {
  line: number;
  column: number;
}

type AllNodes = { [T in t.Node['type']]: Extract<t.Node, { type: T }> };

declare module '@babel/core' {
  namespace types {
    type VisitorKeys = {
      [T in keyof AllNodes]: Extract<
        keyof AllNodes[T],
        {
          [Key in keyof AllNodes[T]]: AllNodes[T][Key] extends (
            | t.Node
            | t.Node[]
            | null)
            ? Key
            : never;
        }[keyof AllNodes[T]]
      >;
    };

    const VISITOR_KEYS: { [T in keyof VisitorKeys]: VisitorKeys[T][] };
    const FLIPPED_ALIAS_KEYS: {
      [T in keyof t.Aliases]: t.Aliases[T]['type'][];
    };
    const NODE_FIELDS: any;

    function shallowEqual(actual: object, expected: object): boolean;
  }
  export interface BabelFileMetadata {
    linaria: LinariaMetadata;
  }
}
