/**
 * Cloudflare Pages (modo avanzado). Funciones en cloudflare/functions.
 * Rutas: /api/* (canónico) y /.netlify/functions/* (alias).
 */
const { handleRequest } = require("./cloudflare/adapter.js");

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
