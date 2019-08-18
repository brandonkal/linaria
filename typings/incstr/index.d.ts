declare module 'incstr' {
  interface Options {
    alphabet?: string;
    lastId?: string;
    numberlike?: boolean;
    prefix?: string;
    suffix?: string;
  }
  const incstr: {
    idGenerator(options: Options): () => string;
  };

  export default incstr;
}
