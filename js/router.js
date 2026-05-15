// History-API router. Routes look like /, /signup, /app, /app/score, etc.
// (Previously used hash routing; navigate('#/foo') still works via back-compat.)
//
// Requires the dev/prod server to fall back to index.html for unknown paths
// (the Express backend's catch-all does this).

const routes = [];
let host = null;
let current = null;
let lastRoute = null;

export function init(rootEl) { host = rootEl; }

// Register a route. `match` is either a string (exact) or a RegExp.
// Renderer receives ({ params, navigate, path, prev }).
export function register(match, render) {
  routes.push({ match, render });
}

// Accepts '/signup', '#/signup', or 'signup'. Pushes a new history entry and
// renders. Same-path calls just re-render without pushing.
export function navigate(path) {
  if (typeof path !== 'string') return;
  if (path.startsWith('#')) path = path.slice(1);
  if (!path.startsWith('/')) path = '/' + path;
  if (location.pathname === path) {
    handleRoute();
  } else {
    history.pushState({}, '', path);
    handleRoute();
  }
}

function findRoute(path) {
  for (const r of routes) {
    if (typeof r.match === 'string') {
      if (r.match === path) return { route: r, params: {} };
    } else {
      const m = path.match(r.match);
      if (m) return { route: r, params: m.groups || {} };
    }
  }
  return null;
}

function handleRoute() {
  const path = location.pathname || '/';
  const found = findRoute(path);
  if (!found) {
    console.warn('No route for', path);
    history.replaceState({}, '', '/');
    return handleRoute();
  }

  let next;
  try {
    next = found.route.render({
      params: found.params,
      navigate,
      path,
      prev: lastRoute,
    });
  } catch (err) {
    console.error('Route render failed:', err);
    return;
  }
  next.classList.add('page');

  if (current) current.remove();
  host.appendChild(next);
  current = next;
  lastRoute = path;

  window.scrollTo(0, 0);
}

export function start() {
  // Back/forward buttons re-render the current path
  window.addEventListener('popstate', handleRoute);

  // Migrate users coming in via the old hash URLs (e.g. someone's
  // bookmark of localhost:3000/#/app/loans) to clean paths.
  if (location.hash && location.hash.startsWith('#/')) {
    const target = location.hash.slice(1);
    history.replaceState({}, '', target);
  }

  handleRoute();
}
