let CURRENT_BATCH = null; // { id, name }
let ACTIVE_TAB = "live";

(async function init() {
  const { user, profile } = await requireAuth();
  guardRole(profile, "student");
  document.getElementById("who").textContent = profile.name || profile.email;
  loadBatches(user.uid);
})();

async function loadBatches(uid) {
  const list = document.getElementById("batch-list");
  const snap = await db.collection("batches").where("studentUids", "array-contains", uid).get();
  if (snap.empty) {
    list.innerHTML = `<div class="empty">You haven't been added to a batch yet. Ask your academy to add you.</div>`;
    return;
  }
  list.innerHTML = "";
  snap.forEach((doc) => {
    const b = doc.data();
    const row = document.createElement("div");
    row.className = "entry gold";
    row.innerHTML = `
      <div class="entry-row">
        <div>
          <h3>${escapeHtml(b.name)}</h3>
          <div class="meta">${escapeHtml(b.description || "")}</div>
        </div>
        <button class="btn small">Open</button>
      </div>`;
    row.querySelector("button").addEventListener("click", () => openBatch(doc.id, b.name));
    list.appendChild(row);
  });
}

function openBatch(id, name) {
  CURRENT_BATCH = { id, name };
  document.getElementById("batch-list").parentElement.querySelector(".section-head").style.display = "none";
  document.getElementById("batch-list").style.display = "none";
  document.getElementById("batch-detail").style.display = "block";
  document.getElementById("batch-title").textContent = name;
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  switchTab("live");
}

function closeBatch() {
  document.getElementById("batch-detail").style.display = "none";
  document.getElementById("batch-list").parentElement.querySelector(".section-head").style.display = "flex";
  document.getElementById("batch-list").style.display = "block";
}

function switchTab(tab) {
  ACTIVE_TAB = tab;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const map = { live: loadLive, videos: loadVideos, materials: loadMaterials, tests: loadTests };
  map[tab]();
}

async function loadLive() {
  const el = document.getElementById("tab-content");
  el.innerHTML = "Loading…";
  const snap = await db.collection("batches").doc(CURRENT_BATCH.id)
    .collection("liveSessions").orderBy("scheduledAt", "desc").limit(20).get();
  if (snap.empty) { el.innerHTML = `<div class="empty">No live sessions scheduled yet.</div>`; return; }
  el.innerHTML = "";
  snap.forEach((doc) => {
    const s = doc.data();
    const ytId = extractYouTubeId(s.url);
    const row = document.createElement("div");
    row.className = "entry";
    const label = s.status === "ended" ? "Watch recording" : "Watch";
    row.innerHTML = `
      <div class="entry-row">
        <div>
          <h3>${escapeHtml(s.title)} <span class="tag ${s.status}">${s.status}</span></h3>
          <div class="meta">${fmtDate(s.scheduledAt)}</div>
        </div>
        <button class="btn gold small">${label}</button>
      </div>
      <div class="video-embed" style="display:none; margin-top:12px;"></div>`;
    const btn = row.querySelector("button");
    const embedBox = row.querySelector(".video-embed");
    btn.addEventListener("click", () => {
      const isOpen = embedBox.style.display === "block";
      if (isOpen) { embedBox.style.display = "none"; embedBox.innerHTML = ""; btn.textContent = label; return; }
      embedBox.style.display = "block";
      btn.textContent = "Close";
      embedBox.innerHTML = ytId
        ? `<div style="position:relative; padding-top:56.25%;"><iframe src="https://www.youtube.com/embed/${ytId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
        : `<p style="font-size:0.85rem;">Couldn't recognize this as a YouTube link.</p>`;
    });
    el.appendChild(row);
  });
}

async function loadVideos() {
  const el = document.getElementById("tab-content");
  el.innerHTML = "Loading…";
  const snap = await db.collection("batches").doc(CURRENT_BATCH.id)
    .collection("videos").orderBy("addedAt", "desc").get();
  if (snap.empty) { el.innerHTML = `<div class="empty">No videos here yet.</div>`; return; }
  el.innerHTML = "";
  snap.forEach((doc) => {
    const v = doc.data();
    const ytId = extractYouTubeId(v.url);
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div>
          <h3>${escapeHtml(v.title)}</h3>
          <div class="meta">${fmtDate(v.addedAt)}</div>
        </div>
        <button class="btn gold small">Watch</button>
      </div>
      <div class="video-embed" style="display:none; margin-top:12px;"></div>`;
    const btn = row.querySelector("button");
    const embedBox = row.querySelector(".video-embed");
    btn.addEventListener("click", () => {
      const isOpen = embedBox.style.display === "block";
      if (isOpen) { embedBox.style.display = "none"; embedBox.innerHTML = ""; btn.textContent = "Watch"; return; }
      embedBox.style.display = "block";
      btn.textContent = "Close";
      embedBox.innerHTML = ytId
        ? `<div style="position:relative; padding-top:56.25%;"><iframe src="https://www.youtube.com/embed/${ytId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
        : `<p style="font-size:0.85rem;">Couldn't recognize this as a YouTube link — <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">open it directly</a> instead.</p>`;
    });
    el.appendChild(row);
  });
}

async function loadMaterials() {
  const el = document.getElementById("tab-content");
  el.innerHTML = "Loading…";
  const snap = await db.collection("batches").doc(CURRENT_BATCH.id)
    .collection("materials").orderBy("uploadedAt", "desc").get();
  if (snap.empty) { el.innerHTML = `<div class="empty">No study materials here yet.</div>`; return; }
  el.innerHTML = "";
  snap.forEach((doc) => {
    const m = doc.data();
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry-row">
        <div>
          <h3>${escapeHtml(m.title)}</h3>
          <div class="meta">${fmtDate(m.uploadedAt)}</div>
        </div>
        <a class="btn ghost small" href="${escapeHtml(m.fileUrl)}" target="_blank" rel="noopener">Open</a>
      </div>`;
    el.appendChild(row);
  });
}

async function loadTests() {
  const el = document.getElementById("tab-content");
  el.innerHTML = "Loading…";
  const uid = auth.currentUser.uid;
  const snap = await db.collection("batches").doc(CURRENT_BATCH.id)
    .collection("tests").orderBy("createdAt", "desc").get();
  if (snap.empty) { el.innerHTML = `<div class="empty">No tests here yet.</div>`; return; }
  el.innerHTML = "";
  for (const doc of snap.docs) {
    const t = doc.data();
    const resultDoc = await doc.ref.collection("results").doc(uid).get();
    const row = document.createElement("div");
    row.className = "entry";
    if (resultDoc.exists) {
      const r = resultDoc.data();
      row.innerHTML = `
        <div class="entry-row">
          <div><h3>${escapeHtml(t.title)}</h3><div class="meta">Completed · Score ${r.score}/${t.numQuestions}</div></div>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="entry-row">
          <div><h3>${escapeHtml(t.title)}</h3><div class="meta">${t.numQuestions} questions</div></div>
          <button class="btn gold small">Start test</button>
        </div>`;
      row.querySelector("button").addEventListener("click", () => openTest(doc.ref, t));
    }
    el.appendChild(row);
  }
}

function openTest(testRef, test) {
  const el = document.getElementById("tab-content");
  const answers = new Array(test.numQuestions).fill(null);
  const fileId = extractDriveFileId(test.questionPaperUrl);
  const profileName = document.getElementById("who").textContent;
  const stamp = `${profileName} · ${new Date().toLocaleString("en-IN")}`;

  el.innerHTML = `
    <div class="form-card" style="max-width:100%;">
      <h3>${escapeHtml(test.title)}</h3>
      <p style="font-size:0.8rem;">Question paper below — mark your answers in the grid underneath it, same as an OMR sheet.</p>
      <div style="position:relative; border:1px solid var(--line); border-radius:4px; overflow:hidden; margin-bottom:20px;">
        ${fileId
          ? `<div style="position:relative; padding-top:129%;"><iframe src="https://drive.google.com/file/d/${fileId}/preview" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allow="autoplay"></iframe></div>`
          : `<div class="empty">Couldn't load the question paper link.</div>`}
        <div style="position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <div style="transform:rotate(-30deg); color:rgba(180,74,74,0.25); font-size:1.1rem; font-weight:700; white-space:nowrap;">${escapeHtml(stamp)}</div>
        </div>
      </div>
      <form id="test-form"></form>
    </div>`;

  const form = document.getElementById("test-form");
  const letters = ["A", "B", "C", "D"];
  form.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:6px; margin-bottom:16px;">` +
    answers.map((_, i) => `
      <div style="border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-size:0.85rem;">
        <div style="font-weight:600; margin-bottom:3px;">Q${i + 1}</div>
        <div style="display:flex; gap:6px;">
          ${letters.map((L) => `<label style="display:flex; align-items:center; gap:2px;">
            <input type="radio" name="q${i}" value="${L}" /> ${L}</label>`).join("")}
        </div>
      </div>`).join("") + `</div>`;
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn gold";
  submitBtn.textContent = "Submit test";
  form.appendChild(submitBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    answers.forEach((_, i) => {
      const checked = form.querySelector(`input[name="q${i}"]:checked`);
      answers[i] = checked ? checked.value : null;
    });
    let score = 0;
    test.correctAnswers.forEach((correct, i) => { if (answers[i] === correct) score++; });
    await testRef.collection("results").doc(auth.currentUser.uid).set({
      score, answers, submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadTests();
  });
}
