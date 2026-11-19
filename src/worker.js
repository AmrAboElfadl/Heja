// Cloudflare Worker entry: serves the website from ./public and runs the two API routes.
// The route handlers are shared with the Pages Functions in functions/api/.
import * as chat from "../functions/api/chat.js";
import * as rates from "../functions/api/rates.js";

const routes = {
  "/api/chat": { POST: chat.onRequestPost, any: chat.onRequest },
  "/api/rates": { GET: rates.onRequestGet, any: rates.onRequest }
};

export default {
  async fetch(request, env, ctx) {
    const route = routes[new URL(request.url).pathname];
    if (route) {
      const handler = route[request.method] || route.any;
      return handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  }
};
