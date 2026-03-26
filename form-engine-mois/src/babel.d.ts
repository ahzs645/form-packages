declare module "@babel/standalone" {
  export function transform(code: string, options: unknown): { code: string };
  export function registerPlugin(name: string, plugin: unknown): void;
  export function registerPreset(name: string, preset: unknown): void;
  export const availablePlugins: Record<string, unknown>;
  export const availablePresets: Record<string, unknown>;
}
