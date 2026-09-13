# YAS Academy — Learning Portal

A batch-gated learning platform: study materials, videos, tests, and live
classes that only the students you've added to a batch can see.

Plain HTML/CSS/JS — no build step, so you can open any file and edit it
directly, same as the current site.

This is the fully-free version: Firebase only for login/database (no paid
plan needed), Google Drive for PDFs, YouTube for videos and live classes.

## What's in here

- `index.html` — sign in
- `dashboard.html` — student view (batches → materials / videos / tests / live)
- `admin.html` — your admin panel (create batches, add students, upload
  content, build tests, schedule live classes)
- `assets/` — shared styles and logic
- `firestore.rules` — the actual access control. This is what genuinely
  stops a student from seeing a batch they're not in — the app's UI is
  just a convenience on top of this.

## One-time setup

### 1. Create a Firebase project (free, no card needed for this part)
1. Go to console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** (start in production
   mode, pick a nearby region).
4. **Project settings → General → Your apps → </> (Web)** → register an
   app → copy the `firebaseConfig` object into `assets/firebase-config.js`,
   replacing the placeholder values.

You do **not** need Firebase Storage for this version — skip it. (If the
console ever nudges you to enable it, ignore it; nothing here uses it.)

### 2. Deploy the security rules
This is what actually enforces "only students in this batch can see this
batch." Paste the contents of `firestore.rules` into the **Rules** tab
under Firestore Database in the Firebase console, and publish. (Or use the
Firebase CLI — `firebase deploy --only firestore:rules` — if you have it
installed.)

### 3. Create your own admin account
The app has no public sign-up screen — you (admin) create every account.
For your own first login:
1. Firebase console → Authentication → Users → **Add user** → your email
   and a password.
2. Firestore → Data → **Start collection** → name it `users` → document ID
   = the UID Firebase just gave that user → add fields: `name` (string),
   `email` (string), `role` = `"admin"` (string).
3. Sign in at `index.html` with that email/password → you land on
   `admin.html`.

Every student account after this, you create from inside the admin panel
itself (Students tab → "Add a new student") — no console work needed.

### 4. Deploy the site
Drag this folder into Netlify (or any static host). No server needed —
everything talks to Firebase, Google Drive, and YouTube directly from the
browser.

## How videos and live classes work

Paste any YouTube link (Unlisted, not Public) into the admin panel's
Videos tab or when scheduling a live session — it plays right inside the
app, no redirect to YouTube itself.

For live classes: you go live using the YouTube app or YouTube Studio on
your own device, same as any normal YouTube livestream — nothing in this
app hosts the stream. Paste that video's link when you schedule the
session. Students see it embedded here while you're live, and the same
link automatically becomes the recording the moment you end the stream —
no extra saving step.

## How study materials and question papers work

Upload PDFs to Google Drive, set sharing to **"Anyone with the link —
Viewer"**, and — this part matters — click **"Disable download, print,
and copy for viewers"** in the sharing settings before pasting the link
into the admin panel. That one setting is what actually stops easy
downloading and copy-pasting.

## About the test system (OMR-style)

Tests here match how your paper exams already work:
1. Upload the question paper as a (protected) Google Drive PDF.
2. Set how many questions it has.
3. Mark the correct answer for each question number (A/B/C/D) — this is
   your answer key.

Students see the question paper on screen with a matching answer grid
underneath — they mark their answers the way they would on a real OMR
sheet, and it's auto-scored against your key on submit. Each student also
sees a faint watermark of their own name and the time across the question
paper while they're viewing it — not a leak-blocker, but if a copy of a
paper ever surfaces outside your batch, the watermark tells you whose
copy it was.

### A clear-eyed note on leak prevention

No website can detect that someone is screen-recording, or shut itself
down when they do — browsers don't give any site that ability, and there's
no way to stop someone pointing a second phone camera at their screen
either, since that happens entirely outside the app. What's here (Drive's
own download/copy block, plus the per-student watermark) is the honest,
real version of what's achievable on the web: it stops casual copying and
makes any leak traceable, but it can't guarantee a leak never happens.
Nobody's web app can promise that, regardless of what it claims.

## One thing worth knowing about test security more generally

The correct-answer key lives in the same test document the student's
browser reads to display the answer grid, so grading happens on their
device. A technically determined student could find the key in their
browser's developer tools. For your regular batch tests this is normal
and how most small coaching apps work. If you ever run something where
the result really matters — a big ranking mock exam — the fix is grading
on a server instead (a Firebase Cloud Function), so the key never reaches
the browser. That's a clean phase-two upgrade, not needed to launch.

## Support

Nothing here calls any paid API. Firebase's free (Spark) plan comfortably
covers a coaching center's login and database usage; Google Drive and
YouTube are free. There's genuinely no recurring cost with this setup
unless you outgrow Firestore's free quota, which is unlikely at your
scale.
