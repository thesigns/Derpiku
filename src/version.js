// App version, shown in Settings. Bump `build` whenever game files change: it also names the service
// worker cache (sw.js imports this file), so installed copies pick up the new files.
(function (root) {
  root.DERPIKU_VERSION = { name: '0.6', build: 15 };
})(typeof self !== 'undefined' ? self : globalThis);
