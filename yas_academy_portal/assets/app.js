// ============================================================
// Shared helpers: auth state, role lookup, batch access.
// Loaded after firebase-config.js on every page.
// ============================================================

/** Resolves with { user, profile } once we know who's signed in, or
 *  redirects to the login page if nobody is. profile is the /users/{uid}
 *  document ({ name, email, role: "admin" | "student" }). */
function requireAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const doc = await db.collection("users").doc(user.uid).get();
      if (!doc.exists) {
        // Signed in with Firebase but no profile doc yet — shouldn't
        // normally happen since admin creates accounts, but fail safe.
        alert("Your account isn't set up yet. Ask your admin to add you to a batch.");
        auth.signOut();
        return;
      }
      resolve({ user, profile: doc.data() });
    });
  });
}

/** Sends a signed-in student who isn't staff back to the student view,
 *  and a signed-in student who tries to open admin.html back out. */
function guardRole(profile, requiredRole) {
  if (profile.role !== requiredRole) {
    window.location.href = profile.role === "admin" ? "admin.html" : "dashboard.html";
    throw new Error("wrong role"); // stop the rest of the page script
  }
}

function signOutAndRedirect() {
  auth.signOut().then(() => (window.location.href = "index.html"));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractDriveFileId(url) {
  if (!url) return null;
  let m = url.match(/\/file\/d\/([\w-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([\w-]+)/);
  if (m) return m[1];
  return null;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
