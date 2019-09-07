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

export type Value = Function | Styled | string | number;

export type ValueStrings = Map<NodePath<t.Expression>, string>;

export type LazyValue = {
  kind: ValueType.LAZY;
  ex: NodePath<t.Expression>;
};

export type RuntimeValue = {
  kind: ValueType.RUNTIME;
  ex: any;
};

export type EvaluatedValue = {
  kind: ValueType.VALUE;
  value: Value;
};

export type ExpressionValue = LazyValue | RuntimeValue | EvaluatedValue;

export type TemplateExpression = {
  styled?: {
    component: NodePath<t.Expression> | { node: t.StringLiteral };
  };
  path: NodePath<t.TaggedTemplateExpression>;
  expressionValues: ExpressionValue[];
  isGlobal: boolean;
};

export type Replacement = {
  original: { start: Location; end: Location };
  length: number;
};

export type Rules = {
  [selector: string]: {
    className: string;
    displayName: string;
    cssText: string;
    start?: Location;
    isGlobal: boolean;
    /** keep track of strings that should be replaced. */
    prevalStrings: string[];
    /** set selectorWrap for wrapped styled components to evaluate a more specific selector. */
    selectorWrap?: string;
  };
};

export type CSSIdentifiers = {
  classNames: string[];
  cssVars: string[];
  modifiers: string[];
};

export type State = {
  queue: TemplateExpression[];
  rules: Rules;
  cssText: string;
  replacements: Replacement[];
  index: number;
  dependencies: string[];
  file: {
    opts: {
      cwd: string;
      root: string;
      filename: string;
    };
    metadata: {
      linaria: LinariaMetadata;
    };
  };
};

export type LinariaMetadata = {
  rules: Rules;
  cssText: string;
  replacements: Replacement[];
  dependencies: string[];
};

export type StrictOptions = {
  displayName: boolean;
  evaluate: boolean;
  ignore: RegExp;
  prefix: string;
  optimize: boolean;
  babelOptions: TransformOptions;
  /** ignore CSS content to speed up compilation when we only wish to extract classNames for evaluation */
  _ignoreCSS: boolean;
  /** set to true when evaluating modules for preval. */
  _isEvaluatePass: boolean;
};

export type Location = {
  line: number;
  column: number;
};

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

    function shallowEqual(actual: object, expected: object): boolean;
  }
}
