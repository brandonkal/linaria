import { StyledComponent } from '../react';

export type Interpolation =
  | string
  | number
  | CSSProperties
  | StyledComponent<any, any>;

export type CSSProperties = {
  [key: string]: string | number | CSSProperties;
};

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
