import generator from '@babel/generator';
import { codeFrameColumns } from '@babel/code-frame';
import { NodePath } from '@babel/traverse';

const fileSources = new WeakMap<SimpleNode, string>();

/**
 * SimpleNode is a simplified Node for throwing error messages.
 * This allows us to rebuild CSS in watch mode without keeping reference to the entire program AST.
 * We simply need to keep track of the location, stringified version, program source, and filename.
 * This alternative node can also be serialized to a string.
 */
class SimpleNode {
  loc: any;
  stringified: string;
  filename: string;
  constructor(nodePath: NodePath, filename: string, programSource: string) {
    fileSources.set(this, programSource);
    this.loc = { ...nodePath.node.loc };
    this.filename = filename;
    this.stringified = generator(nodePath.node).code;
  }
  buildCodeFrameError(msg: string, Error: any = SyntaxError) {
    msg =
      `${this.filename}: ${msg}\n` +
      codeFrameColumns(
        this.code,
        {
          start: {
            line: this.loc.start.line,
            column: this.loc.start.column + 1,
          },
        },
        {
          highlightCode: true,
        }
      );
    return new Error(msg);
  }

  get code() {
    return fileSources.get(this) || '';
  }
  toJSON() {
    return {
      loc: this.loc,
      filename: this.filename,
      stringified: this.stringified,
    };
  }
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export default SimpleNode;
