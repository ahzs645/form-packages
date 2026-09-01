/**
 * Minimal `require` for form source that expects a CommonJS host (the real
 * MOIS runtime provides one). Mirrors the app preview's shim: prop-types and
 * electron are stubbed, anything else returns an empty module with a warning.
 */
export function createPlayerRequireShim(): (moduleName: string) => unknown {
  const propType = Object.assign(() => null, { isRequired: () => null });
  const propTypes = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (_target, property) => {
        if (property === "__esModule") return false;
        if (property === "default") return propTypes;
        return propType;
      },
    },
  );
  const electron = {
    ipcRenderer: {
      send: () => undefined,
      sendSync: () => undefined,
      invoke: async () => undefined,
      on: () => undefined,
      once: () => undefined,
      removeListener: () => undefined,
      removeAllListeners: () => undefined,
    },
  };
  return (moduleName: string) => {
    if (moduleName === "prop-types") return propTypes;
    if (moduleName === "electron") return electron;
    console.warn(`cerner-player require shim returning empty module for ${moduleName}`);
    return {};
  };
}
