declare module 'webpack-virtual-modules' {
  interface StaticModules {
    [path: string]: string;
  }
  class VirtualModulesPlugin {
    constructor(staticModules?: StaticModules);
    apply: (compiler: any) => void;
    writeModule: (path: string, contents: string) => void;
  }
  export default VirtualModulesPlugin;
}
