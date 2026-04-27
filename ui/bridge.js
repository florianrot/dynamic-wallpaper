// Universal pywebview API bridge
// Works in Standalone mode (direct js_api) and Modu mode (call_module routing)
// Usage: const result = await api.methodName(arg1, arg2);

const api = new Proxy({}, {
  get(_, method) {
    return async (...args) => {
      const bridge = window.pywebview?.api
                  || window.parent?.pywebview?.api;
      if (!bridge) throw new Error("pywebview bridge not available");
      if (typeof bridge[method] === "function") return await bridge[method](...args);
      if (typeof bridge.call_module === "function") {
        const moduleName = document.documentElement.dataset.moduleName;
        if (moduleName) return await bridge.call_module(moduleName, method, ...args);
      }
      throw new Error(`method ${method} not reachable`);
    };
  }
});

function isModuContext() {
  const bridge = window.pywebview?.api
              || window.parent?.pywebview?.api;
  return !!(bridge && typeof bridge.call_module === "function"
            && typeof bridge.set_module_autostart === "function");
}
