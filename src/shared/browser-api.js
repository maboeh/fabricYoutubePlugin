// Cross-browser API compatibility layer
// Safari uses "browser.*" (W3C WebExtensions standard), Chrome uses "chrome.*"
// Both support Promises in Manifest V3, so a simple namespace switch suffices.
// The browser.runtime check ensures we don't pick up an unrelated global "browser" variable.
export const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
