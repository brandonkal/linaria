export default function fixError(e: any): Error {
  if (!(e instanceof Error)) {
    const errorLike: boolean = e.message && e.stack;
    const fauxError = Error(errorLike ? e.message : e);
    if (errorLike) {
      fauxError.message = e.message;
      fauxError.stack = e.stack;
    }
    e = fauxError;
  }
  return e;
}
