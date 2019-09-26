import { StyledComponent } from '../react';
import * as CSS from 'csstype'; // eslint-disable-line import/no-unresolved

export type Interpolation =
  | string
  | number
  | CSSObject
  | StyledComponent<any, any>;

export type CSSProperties = CSS.Properties<string | number>;

export type CSSPseudos = { [K in CSS.Pseudos]?: CSSObject };

export interface CSSObject extends CSSProperties, CSSPseudos {
  [key: string]: CSSObject | string | number | undefined;
}

// Override css return type for TS
type CssFn = (
  _strings: TemplateStringsArray,
  ..._exprs: Interpolation[]
) => string;

function css(_strings: TemplateStringsArray, ..._exprs: Interpolation[]): void {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Using the "css" or "injectGlobal" tag in runtime is not supported. Have you set up the Babel plugin correctly?'
    );
  }
}

export default css as CssFn;
