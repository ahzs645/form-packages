declare module '@babel/standalone' {
  export function transform(code: string, options: any): { code: string };
  export function registerPlugin(name: string, plugin: any): void;
  export function registerPreset(name: string, preset: any): void;
  export const availablePlugins: Record<string, any>;
  export const availablePresets: Record<string, any>;
}
