import Module from '../module';
export default function mtime(filename: string) {
  try {
    return +Module._fs.statSync(filename).mtime;
  } catch (e) {
    return Date.now();
  }
}
