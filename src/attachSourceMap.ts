/* istanbul ignore file */
import convert from 'convert-source-map';

const re = /\/\*# sourceMappingURL=data:application\/json;base64,.*$/m;

/**
 * **Linaria attachSourceMap Loader**
 *
 * Takes generated CSS file from Linaria and reads and removes the source map comment.
 * An instance of convert-source-map is attached as metadata to the file.
 * After processing the css with PostCSS,
 * this should be followed by the **fixSourceMap loader**,
 * which will replace the source file name and source contents in the generated source map.
 */
export default function loader(this: any, code: string, map: any, meta: any) {
  if (this.resourcePath.includes('linaria.css') && re.test(code)) {
    let match = code.match(re);
    if (match) {
      map = convert.fromComment(match.pop());
    }
    // Overwrite map and attach meta
    code = code.replace(re, '');
    if (!meta) meta = {};
    meta.linaria = {
      originalSourceMapConverter: map,
    };
    this.callback(null, code, map ? map.toObject() : undefined, meta);
  } else {
    this.callback(null, code, map, meta);
  }
}
