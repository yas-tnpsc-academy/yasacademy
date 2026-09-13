let CURRENT_BATCH = null;

(async function init() {
  const { profile } = await requireAuth();
  guardRole(profile, "admin");
  document.getElementById("who").textContent = profile.name || profile.email;
  loadBatches();
})();

/* ============================== Batches ============================== */

function showNewBatchForm() { document.getElementById("new-batch-form").style.display = "block"; }
function hideNewBatchForm() { document.getElementById("new-batch-form").style.display = "none"; }

async function createBatch() {
  const name = document.getElementById("nb-name").value.trim();
  const description = document.getElementById("nb-desc").value.trim();
  if (!name) return alert("Give the batch a name.");
  await db.collection("batches").add({
    name, description, studentUids: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById("nb-name").value = "";
  document.getElementById("nb-desc").value = "";
  hideNewBatchForm();
  loadBatches();
}

async function loadBatches() {
  const list = document.getElementById("batch-list");
  const snap = await db.collection("batches").orderBy("createdAt", "desc").get();
  if (snap.empty) { list.innerHTML = `<div class="empty">No batches yet — create your first one above.</div>`; return; }
  list.innerHTML = "";
  snap.forEach((doc) => {
    const b = doc.data();
    const row = document.createElement("div");
    row.className = "entry gold";
    row.innerHTML = `
      <div class="entry-row">
        <div>
          <h3>${escapeHtml(b.name)}</h3>
          <div class="meta">${(b.studentUids || []).length} students · ${escapeHtml(b.description || "")}</div>
        </div>
        <button class="btn small">Manage</button>
      </div>`;
    row.querySelector("button").addEventListener("click", () => openBatch(doc.id, b.name));
    list.appendChild(row);
  });
}

function openBatch(id, name) {
  CURRENT_BATCH = { id, name };
  document.getElementById("batch-list-view").style.display = "none";
  document.getElementById("batch-detail-view").style.display = "block";
  document.getElementById("batch-title").textContent = name;
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  switchTab("students");
}

function closeBatch() {
  document.getElementById("batch-detail-view").style.display = "none";
  document.getElementById("batch-list-view").style.display = "block";
  loadBatches();
}

function switchTab(tab) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const map = { students: renderStudents, materials: renderMaterials, videos: renderVideos, tests: renderTests, live: renderLive };
  map[tab]();
}

/* ============================== Students ============================== */

function getSecondaryAuth() {
  let app;
  try { app = firebase.app("Secondary"); }
  catch (e) { app = firebase.initializeApp(firebaseConfig, "Secondary"); }
  return app.auth();
}

async function renderStudents() {
  const el = document.getElementById("tab-content");
  const batchRef = db.collection("batches").doc(CURRENT_BATCH.id);
  const batchDoc = await batchRef.get();
  const uids = batchDoc.data().studentUids || [];

  el.innerHTML = `
    <div class="form-card" style="margin-bottom:24px;">
      <h3 style="font-size:1rem;">Add a new student</h3>
      <p style="font-size:0.82rem;">Creates their login and adds them to this batch in one step.</p>
      <div class="field"><label>Name</label><input id="ns-name" /></div>
      <div class="field"><label>Email</label><input id="ns-email" type="email" /></div>
      <div class="field"><label>Temporary password (share with them)</label><input id="ns-pass" /></div>
      <button class="btn gold" id="ns-submit">Add student</button>
      <div id="ns-msg" class="msg"></div>
    </div>
    <div class="form-card" style="margin-bottom:24px;">
      <h3 style="font-size:1rem;">Add an existing student</h3>
      <p style="font-size:0.82rem;">If they're already in another batch, add them here by their email instead.</p>
      <div class="field"><label>Email</label><input id="es-email" type="email" /></div>
      <button class="btn ghost" id="es-submit">Add to this batch</button>
      <div id="es-msg" class="msg"></div>
    </div>
    <h3 style="font-size:1rem;">Roster (${uids.length})</h3>
    <div id="roster">Loading…</div>
  `;

  document.getElementById("ns-submit").addEventListener("click", async () => {
    const name = document.getElementById("ns-name").value.trim();
    const email = document.getElementById("ns-email").value.trim();
    const pass = document.getElementById("ns-pass").value;
    const msg = document.getElementById("ns-msg");
    if (!name || !email || pass.length < 6) {
      msg.textContent = "Fill in name, email, and a password of at least 6 characters.";
      msg.className = "msg error"; return;
    }
    try {
      const secondaryAuth = getSecondaryAuth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
      await db.collection("users").doc(cred.user.uid).set({
        name, email, role: "student", createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await secondaryAuth.signOut();
      await batchRef.update({ studentUids: firebase.firestore.FieldValue.arrayUnion(cred.user.uid) });
      msg.textContent = `Added. Share these login details with ${name}.`;
      msg.className = "msg ok";
      document.getElementById("ns-name").value = "";
      document.getElementById("ns-email").value = "";
      document.getElementById("ns-pass").value = "";
      renderStudents();
    } catch (err) {
      msg.textContent = err.code === "auth/email-already-in-use"
        ? "That email already has an account — use 'Add an existing student' below instead."
        : "Couldn't create the account — " + err.message;
      msg.className = "msg error";
    }
  });

  document.getElementById("es-submit").addEventListener("click", async () => {
    const email = document.getElementById("es-email").value.trim();
    const msg = document.getElementById("es-msg");
    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) { msg.textContent = "No account with that email yet — use 'Add a new student' instead."; msg.className = "msg error"; return; }
    const uid = userSnap.docs[0].id;
    await batchRef.update({ studentUids: firebase.firestore.FieldValue.arrayUnion(uid) });
    msg.textContent = "Added to batch."; msg.className = "msg ok";
    document.getElementById("es-email").value = "";
    renderStudents();
  });

  const roster = document.getElementById("roster");
  if (uids.length === 0) { roster.innerHTML = `<div class="empty">No students in this batch yet.</div>`; return; }
  roster.innerHTML = "";
  for (const uid of uids) {
    const userDoc = await db.collection("users").doc(uid).get();
    const u = userDoc.exists ? userDoc.data() : { name: "(unknown)", email: uid };
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div><h3>${escapeHtml(u.name)}</h3><div class="meta">${escapeHtml(u.email)}</div></div>
        <button class="btn danger small">Remove</button>
      </div>`;
    row.querySelector("button").addEventListener("click", async () => {
      if (!confirm(`Remove ${u.name} from this batch? They'll lose access to its content.`)) return;
      await batchRef.update({ studentUids: firebase.firestore.FieldValue.arrayRemove(uid) });
      renderStudents();
    });
    roster.appendChild(row);
  }
}

/* ============================== Materials ============================== */

async function renderMaterials() {
  const el = document.getElementById("tab-content");
  const colRef = db.collection("batches").doc(CURRENT_BATCH.id).collection("materials");
  el.innerHTML = `
    <div class="form-card" style="margin-bottom:24px;">
      <h3 style="font-size:1rem;">Add study material</h3>
      <p style="font-size:0.82rem;">Upload the file to Google Drive, share it as "Anyone with the link — Viewer", then paste the link here.</p>
      <div class="field"><label>Title</label><input id="mat-title" /></div>
      <div class="field"><label>Google Drive link</label><input id="mat-url" placeholder="https://drive.google.com/file/d/..." /></div>
      <button class="btn gold" id="mat-submit">Add material</button>
      <div id="mat-msg" class="msg"></div>
    </div>
    <div id="mat-list">Loading…</div>
  `;
  document.getElementById("mat-submit").addEventListener("click", async () => {
    const title = document.getElementById("mat-title").value.trim();
    const fileUrl = document.getElementById("mat-url").value.trim();
    const msg = document.getElementById("mat-msg");
    if (!title || !fileUrl) { msg.textContent = "Add a title and a Drive link."; msg.className = "msg error"; return; }
    await colRef.add({ title, fileUrl, uploadedAt: firebase.firestore.FieldValue.serverTimestamp() });
    msg.textContent = "Added."; msg.className = "msg ok";
    document.getElementById("mat-title").value = "";
    document.getElementById("mat-url").value = "";
    renderMaterials();
  });

  const listEl = document.getElementById("mat-list");
  const snap = await colRef.orderBy("uploadedAt", "desc").get();
  if (snap.empty) { listEl.innerHTML = `<div class="empty">No materials yet.</div>`; return; }
  listEl.innerHTML = "";
  snap.forEach((doc) => {
    const m = doc.data();
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div><h3>${escapeHtml(m.title)}</h3><div class="meta">${fmtDate(m.uploadedAt)}</div></div>
        <div style="display:flex; gap:8px;">
          <a class="btn ghost small" href="${escapeHtml(m.fileUrl)}" target="_blank" rel="noopener">Open</a>
          <button class="btn danger small">Delete</button>
        </div>
      </div>`;
    row.querySelector("button.danger").addEventListener("click", async () => {
      if (!confirm("Delete this material?")) return;
      await doc.ref.delete();
      renderMaterials();
    });
    listEl.appendChild(row);
  });
}

/* ============================== Videos ============================== */

async function renderVideos() {
  const el = document.getElementById("tab-content");
  const colRef = db.collection("batches").doc(CURRENT_BATCH.id).collection("videos");
  el.innerHTML = `
    <div class="form-card" style="margin-bottom:24px;">
      <h3 style="font-size:1rem;">Add a video</h3>
      <p style="font-size:0.82rem;">Paste a link — an unlisted YouTube upload, or a recording link from your live-class provider.</p>
      <div class="field"><label>Title</label><input id="vid-title" /></div>
      <div class="field"><label>Video URL</label><input id="vid-url" placeholder="https://..." /></div>
      <button class="btn gold" id="vid-submit">Add video</button>
      <div id="vid-msg" class="msg"></div>
    </div>
    <div id="vid-list">Loading…</div>
  `;
  document.getElementById("vid-submit").addEventListener("click", async () => {
    const title = document.getElementById("vid-title").value.trim();
    const url = document.getElementById("vid-url").value.trim();
    const msg = document.getElementById("vid-msg");
    if (!title || !url) { msg.textContent = "Add a title and a URL."; msg.className = "msg error"; return; }
    await colRef.add({ title, url, addedAt: firebase.firestore.FieldValue.serverTimestamp() });
    msg.textContent = "Added."; msg.className = "msg ok";
    document.getElementById("vid-title").value = "";
    document.getElementById("vid-url").value = "";
    renderVideos();
  });

  const listEl = document.getElementById("vid-list");
  const snap = await colRef.orderBy("addedAt", "desc").get();
  if (snap.empty) { listEl.innerHTML = `<div class="empty">No videos yet.</div>`; return; }
  listEl.innerHTML = "";
  snap.forEach((doc) => {
    const v = doc.data();
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div><h3>${escapeHtml(v.title)}</h3><div class="meta">${fmtDate(v.addedAt)}</div></div>
        <div style="display:flex; gap:8px;">
          <a class="btn ghost small" href="${escapeHtml(v.url)}" target="_blank" rel="noopener">Open</a>
          <button class="btn danger small">Delete</button>
        </div>
      </div>`;
    row.querySelector("button.danger").addEventListener("click", async () => {
      if (!confirm("Delete this video entry?")) return;
      await doc.ref.delete();
      renderVideos();
    });
    listEl.appendChild(row);
  });
}

/* ============================== Tests (OMR-style) ============================== */

let DRAFT_ANSWER_KEY = [];

async function renderTests() {
  const el = document.getElementById("tab-content");
  const colRef = db.collection("batches").doc(CURRENT_BATCH.id).collection("tests");
  DRAFT_ANSWER_KEY = [];
  el.innerHTML = `
    <div class="form-card" style="margin-bottom:24px; max-width:640px;">
      <h3 style="font-size:1rem;">Create a test</h3>
      <p style="font-size:0.82rem;">Upload the question paper to Google Drive first. In Drive's Share settings, set it to "Anyone with the link — Viewer", then turn on "Disable download, print, and copy for viewers" before pasting the link below — that's what actually stops easy copying.</p>
      <div class="field"><label>Test title</label><input id="test-title" /></div>
      <div class="field"><label>Question paper — Google Drive link</label><input id="test-paper-url" placeholder="https://drive.google.com/file/d/..." /></div>
      <div class="field">
        <label>Number of questions</label>
        <div style="display:flex; gap:8px;">
          <input id="test-numq" type="number" min="1" max="200" value="20" style="max-width:100px;" />
          <button class="btn ghost small" id="gen-key">Generate answer key</button>
        </div>
      </div>
      <div id="key-builder" style="margin-top:10px;"></div>
      <div style="margin-top:14px;"><button class="btn gold" id="save-test">Save test</button></div>
      <div id="test-msg" class="msg"></div>
    </div>
    <div id="test-list">Loading…</div>
  `;
  document.getElementById("gen-key").addEventListener("click", () => {
    const n = Math.max(1, Math.min(200, Number(document.getElementById("test-numq").value) || 0));
    DRAFT_ANSWER_KEY = new Array(n).fill(null);
    renderKeyBuilder();
  });
  document.getElementById("save-test").addEventListener("click", saveTest);
  document.getElementById("gen-key").click(); // build the default answer-key grid

  const listEl = document.getElementById("test-list");
  const snap = await colRef.orderBy("createdAt", "desc").get();
  if (snap.empty) { listEl.innerHTML = `<div class="empty">No tests yet.</div>`; return; }
  listEl.innerHTML = "";
  snap.forEach((doc) => {
    const t = doc.data();
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div><h3>${escapeHtml(t.title)}</h3><div class="meta">${t.numQuestions} questions · ${fmtDate(t.createdAt)}</div></div>
        <div style="display:flex; gap:8px;">
          <button class="btn ghost small">Results</button>
          <button class="btn danger small">Delete</button>
        </div>
      </div>
      <div class="results-panel" style="display:none; margin-top:12px;"></div>`;
    row.querySelector("button.ghost").addEventListener("click", async () => {
      const panel = row.querySelector(".results-panel");
      if (panel.style.display === "block") { panel.style.display = "none"; return; }
      panel.style.display = "block";
      panel.innerHTML = "Loading…";
      const results = await doc.ref.collection("results").get();
      if (results.empty) { panel.innerHTML = `<div class="empty">No submissions yet.</div>`; return; }
      let rows = "";
      for (const r of results.docs) {
        const u = await db.collection("users").doc(r.id).get();
        rows += `<div class="meta">${escapeHtml(u.exists ? u.data().name : r.id)} — ${r.data().score}/${t.numQuestions}</div>`;
      }
      panel.innerHTML = rows;
    });
    row.querySelector("button.danger").addEventListener("click", async () => {
      if (!confirm("Delete this test and its results?")) return;
      await doc.ref.delete();
      renderTests();
    });
    listEl.appendChild(row);
  });
}

function renderKeyBuilder() {
  const wrap = document.getElementById("key-builder");
  const letters = ["A", "B", "C", "D"];
  wrap.innerHTML = `<p style="font-size:0.8rem; margin:6px 0;">Mark the correct answer for every question, like filling an OMR key:</p>` +
    `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:6px;">` +
    DRAFT_ANSWER_KEY.map((_, i) => `
      <div style="border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-size:0.82rem;">
        <div style="font-weight:600; margin-bottom:3px;">Q${i + 1}</div>
        <div style="display:flex; gap:6px;">
          ${letters.map((L) => `<label style="display:flex; align-items:center; gap:2px;">
            <input type="radio" name="key-${i}" data-qi="${i}" data-letter="${L}" /> ${L}</label>`).join("")}
        </div>
      </div>`).join("") + `</div>`;
  wrap.querySelectorAll("input[type=radio]").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      DRAFT_ANSWER_KEY[Number(e.target.dataset.qi)] = e.target.dataset.letter;
    });
  });
}

async function saveTest() {
  const title = document.getElementById("test-title").value.trim();
  const paperUrl = document.getElementById("test-paper-url").value.trim();
  const msg = document.getElementById("test-msg");
  if (!title || !paperUrl) { msg.textContent = "Add a title and the question paper link."; msg.className = "msg error"; return; }
  if (!extractDriveFileId(paperUrl)) { msg.textContent = "That doesn't look like a Google Drive file link."; msg.className = "msg error"; return; }
  if (DRAFT_ANSWER_KEY.length === 0 || DRAFT_ANSWER_KEY.some((a) => !a)) { msg.textContent = "Mark the correct answer for every question first."; msg.className = "msg error"; return; }
  await db.collection("batches").doc(CURRENT_BATCH.id).collection("tests").add({
    title, questionPaperUrl: paperUrl, numQuestions: DRAFT_ANSWER_KEY.length,
    correctAnswers: DRAFT_ANSWER_KEY, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  msg.textContent = "Test saved."; msg.className = "msg ok";
  renderTests();
}

/* ============================== Live sessions ============================== */

async function renderLive() {
  const el = document.getElementById("tab-content");
  const colRef = db.collection("batches").doc(CURRENT_BATCH.id).collection("liveSessions");
  el.innerHTML = `
    <div class="form-card" style="margin-bottom:24px; max-width:480px;">
      <h3 style="font-size:1rem;">Schedule a live class</h3>
      <p style="font-size:0.82rem;">Go live using the YouTube app or YouTube Studio, set to Unlisted. Paste that video's link here — the same link shows students the stream while you're live, and automatically becomes the recording once you end it.</p>
      <div class="field"><label>Title</label><input id="ls-title" /></div>
      <div class="field"><label>Date &amp; time</label><input id="ls-when" type="datetime-local" /></div>
      <div class="field"><label>YouTube link</label><input id="ls-url" placeholder="https://youtube.com/watch?v=... or youtu.be/..." /></div>
      <button class="btn gold" id="ls-submit">Schedule</button>
      <div id="ls-msg" class="msg"></div>
    </div>
    <div id="ls-list">Loading…</div>
  `;
  document.getElementById("ls-submit").addEventListener("click", async () => {
    const title = document.getElementById("ls-title").value.trim();
    const when = document.getElementById("ls-when").value;
    const url = document.getElementById("ls-url").value.trim();
    const msg = document.getElementById("ls-msg");
    if (!title || !when || !url) { msg.textContent = "Fill in every field."; msg.className = "msg error"; return; }
    if (!extractYouTubeId(url)) { msg.textContent = "That doesn't look like a YouTube link."; msg.className = "msg error"; return; }
    await colRef.add({
      title, scheduledAt: firebase.firestore.Timestamp.fromDate(new Date(when)),
      url, status: "scheduled",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msg.textContent = "Scheduled."; msg.className = "msg ok";
    document.getElementById("ls-title").value = "";
    document.getElementById("ls-url").value = "";
    renderLive();
  });

  const listEl = document.getElementById("ls-list");
  const snap = await colRef.orderBy("scheduledAt", "desc").get();
  if (snap.empty) { listEl.innerHTML = `<div class="empty">No live sessions scheduled yet.</div>`; return; }
  listEl.innerHTML = "";
  snap.forEach((doc) => {
    const s = doc.data();
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div><h3>${escapeHtml(s.title)} <span class="tag ${s.status}">${s.status}</span></h3><div class="meta">${fmtDate(s.scheduledAt)}</div></div>
      </div>
      <div class="live-controls" style="margin-top:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;"></div>`;
    const controls = row.querySelector(".live-controls");
    if (s.status === "scheduled") {
      const b = document.createElement("button"); b.className = "btn small gold"; b.textContent = "Mark as started";
      b.addEventListener("click", async () => { await doc.ref.update({ status: "live" }); renderLive(); });
      controls.appendChild(b);
    }
    if (s.status === "live") {
      const b = document.createElement("button"); b.className = "btn small"; b.textContent = "End class";
      b.addEventListener("click", async () => { await doc.ref.update({ status: "ended" }); renderLive(); });
      controls.appendChild(b);
    }
    const del = document.createElement("button"); del.className = "btn danger small"; del.textContent = "Delete";
    del.addEventListener("click", async () => { if (confirm("Delete this session?")) { await doc.ref.delete(); renderLive(); } });
    controls.appendChild(del);
    listEl.appendChild(row);
  });
}
