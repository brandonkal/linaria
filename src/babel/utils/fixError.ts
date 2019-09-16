export default function fixError(e: any): Error {
  if (!(e instanceof Error)) {
    const errorLike: boolean = e.message && e.stack;
    const fauxError = Error(errorLike ? e.message : e);
    if (errorLike) {
      fauxError.name = e.name;
      fauxError.message = e.message;
      fauxError.stack = e.stack;
      // @ts-ignore -- no clean way to add this
      fauxError.code = e.code;
    }
    e = fauxError;
  }
  return e;
}
