import Module from '../module';
export default function mtime(filename: string, fallback?: number) {
  try {
    return Module._fs.statSync(filename).mtimeMs;
  } catch (e) {
    return fallback || Date.now();
  }
}
