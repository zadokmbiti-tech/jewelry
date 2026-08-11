// Simple shared-secret gate for the admin pages (admin.html / manage.html).
// This is NOT a full user-account system  it's a single password shared by
// whoever is allowed to manage products, appropriate for a solo-owner shop.
// The real enforcement happens server-side (main.py's require_admin and
// api/upload.js)  this file's job is just to collect the password once and
// attach it to every admin request.

(function () {
  const STORAGE_KEY = 'jewelry_admin_secret';

  function getStoredSecret() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  function askForSecret() {
    const entered = window.prompt('Admin password:');
    if (entered) {
      sessionStorage.setItem(STORAGE_KEY, entered);
    }
    return entered || '';
  }

  // Ensures we have a password before showing the admin page at all.
  // Call this at the top of admin.html / manage.html.
  window.requireAdminLogin = function () {
    if (!getStoredSecret()) {
      askForSecret();
    }
  };

  // Drop-in replacement for fetch() for any request that hits a protected
  // endpoint (FastAPI /admin/* routes, or the /api/upload function).
  // On a 401 it clears the stored password and asks again so the next
  // request has a chance to succeed instead of failing forever.
  window.adminFetch = async function (url, options = {}) {
    const secret = getStoredSecret();
    const headers = Object.assign({}, options.headers, {
      'X-Admin-Secret': secret,
    });
    const response = await fetch(url, Object.assign({}, options, { headers }));

    if (response.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      alert('Admin password was incorrect or missing. Please re-enter it.');
    }
    return response;
  };
})();
