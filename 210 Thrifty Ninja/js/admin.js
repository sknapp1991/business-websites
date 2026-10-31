const SOLD_ARCHIVE_DAYS = 7;
const soldState = {}; // id -> { sold, soldAt (ms|null) }
const reservedUntilState = {}; // id -> ms

function isRecentlySold(id) {
  const state = soldState[id];
  if (!state || !state.sold) return false;
  if (!state.soldAt) return true; // no timestamp yet (just marked) — treat as recent
  return (Date.now() - state.soldAt) < SOLD_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
}

function renderAdminList(filterText) {
  const list = document.getElementById("admin-list");
  const term = (filterText || "").toLowerCase();
  const now = Date.now();
  const items = PRODUCTS.filter(p => {
    const state = soldState[p.id];
    // Items sold more than SOLD_ARCHIVE_DAYS ago move to the Sales History tab.
    if (state && state.sold && !isRecentlySold(p.id)) return false;
    if (!term) return true;
    return p.name.toLowerCase().includes(term) ||
           (p.brand || "").toLowerCase().includes(term) ||
           (p.tag || "").toLowerCase().includes(term) ||
           p.id.includes(term);
  });

  document.getElementById("admin-count").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

  list.innerHTML = items.map(p => {
    const sold = !!soldState[p.id] && soldState[p.id].sold;
    const reservedUntil = reservedUntilState[p.id] || 0;
    const reserved = !sold && reservedUntil > now;
    const reservedTag = reserved
      ? `<span class="admin-reserved-tag">Reserved ~${Math.max(1, Math.ceil((reservedUntil - now) / 60000))}m</span>`
      : "";
    const releaseBtn = reserved
      ? `<button class="btn btn-sm btn-ghost admin-release" data-id="${p.id}">Unreserve</button>`
      : "";
    return `
      <div class="admin-row ${sold ? "is-sold" : reserved ? "is-reserved" : ""}">
        <img src="${p.image || ""}" alt="" class="admin-thumb" loading="lazy">
        <div class="admin-row-info">
          <div class="admin-row-name">${p.name} ${reservedTag}</div>
          <div class="admin-row-meta">${p.tag || ""} ${p.brand || ""} ${p.size ? "&middot; " + p.size : ""} &middot; $${p.price}</div>
        </div>
        <div class="admin-row-actions">
          ${releaseBtn}
          <button class="btn btn-sm ${sold ? "btn-ghost" : "btn-accent"} admin-toggle" data-id="${p.id}">
            ${sold ? "Mark Available" : "Mark Sold"}
          </button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".admin-toggle").forEach(btn => {
    btn.addEventListener("click", () => toggleSold(btn.dataset.id));
  });
  list.querySelectorAll(".admin-release").forEach(btn => {
    btn.addEventListener("click", () => releaseReservation(btn.dataset.id));
  });
}

function renderHistoryList(filterText) {
  const list = document.getElementById("history-list");
  if (!list) return;
  const term = (filterText || "").toLowerCase();

  const sold = PRODUCTS
    .filter(p => soldState[p.id] && soldState[p.id].sold)
    .filter(p => {
      if (!term) return true;
      return p.name.toLowerCase().includes(term) ||
             (p.brand || "").toLowerCase().includes(term) ||
             (p.tag || "").toLowerCase().includes(term);
    })
    .sort((a, b) => (soldState[b.id].soldAt || 0) - (soldState[a.id].soldAt || 0));

  document.getElementById("history-count").textContent = `${sold.length} sold item${sold.length === 1 ? "" : "s"}`;

  list.innerHTML = sold.map(p => {
    const soldAt = soldState[p.id].soldAt;
    const dateText = soldAt ? new Date(soldAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "recently";
    return `
      <div class="admin-row is-sold">
        <img src="${p.image || ""}" alt="" class="admin-thumb" loading="lazy">
        <div class="admin-row-info">
          <div class="admin-row-name">${p.name}</div>
          <div class="admin-row-meta">${p.tag || ""} ${p.brand || ""} &middot; $${p.price} &middot; Sold ${dateText}</div>
        </div>
        <button class="btn btn-sm btn-ghost admin-toggle" data-id="${p.id}">Mark Available</button>
      </div>`;
  }).join("");

  list.querySelectorAll(".admin-toggle").forEach(btn => {
    btn.addEventListener("click", () => toggleSold(btn.dataset.id));
  });
}

function releaseReservation(id) {
  db.collection("reservations").doc(id).delete()
    .catch(err => alert("Couldn't release: " + err.message));
}

function toggleSold(id) {
  const current = soldState[id] && soldState[id].sold;
  const next = !current;
  db.collection("soldItems").doc(id).set({
    sold: next,
    soldAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => alert("Couldn't update: " + err.message));
}

function refreshAllViews() {
  renderAdminList(document.getElementById("admin-search").value);
  renderHistoryList(document.getElementById("history-search").value);
}

function listenForSoldChanges() {
  db.collection("soldItems").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const data = change.doc.data();
      soldState[change.doc.id] = {
        sold: !!data.sold,
        soldAt: data.soldAt ? data.soldAt.toMillis() : null
      };
    });
    refreshAllViews();
  });

  db.collection("reservations").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "removed") {
        delete reservedUntilState[change.doc.id];
      } else {
        const until = change.doc.data().reservedUntil;
        reservedUntilState[change.doc.id] = until ? until.toMillis() : 0;
      }
    });
    renderAdminList(document.getElementById("admin-search").value);
  });

  // Keep countdowns fresh and move 7-day-old sales into history automatically.
  setInterval(refreshAllViews, 20000);
}

window.onProductsSynced = refreshAllViews;

// ---- Tabs ----
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".admin-tab-panel").forEach(p => p.hidden = true);
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

// ---- Add Listing ----
document.getElementById("add-listing-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("add-listing-status");
  statusEl.textContent = "";
  statusEl.style.color = "";

  const name = document.getElementById("new-name").value.trim();
  const price = parseFloat(document.getElementById("new-price").value);
  if (!name || isNaN(price) || price < 0) {
    statusEl.textContent = "Please enter a name and a valid price.";
    return;
  }

  const tagRaw = document.getElementById("new-tag").value.trim();
  const docRef = db.collection("products").doc();
  const product = {
    tag: tagRaw ? `#${tagRaw.replace(/^#/, "")}` : "",
    name: name,
    price: price,
    brand: document.getElementById("new-brand").value.trim(),
    size: document.getElementById("new-size").value.trim(),
    condition: document.getElementById("new-condition").value.trim(),
    category: document.getElementById("new-category").value,
    description: document.getElementById("new-description").value.trim(),
    image: document.getElementById("new-image").value.trim(),
    vintedUrl: "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  docRef.set(product)
    .then(() => {
      statusEl.style.color = "var(--accent-teal)";
      statusEl.textContent = `"${name}" added to the shop!`;
      document.getElementById("add-listing-form").reset();
    })
    .catch(err => { statusEl.textContent = "Couldn't add listing: " + err.message; });
});

// ---- Auth ----
firebase.auth().onAuthStateChanged(user => {
  document.getElementById("login-screen").hidden = !!user;
  document.getElementById("admin-screen").hidden = !user;
  if (user) listenForSoldChanges();
});

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(() => { errEl.textContent = "Login failed — check email and password."; });
});

document.getElementById("logout-btn").addEventListener("click", () => {
  firebase.auth().signOut();
});

document.getElementById("admin-search").addEventListener("input", (e) => {
  renderAdminList(e.target.value);
});

document.getElementById("history-search").addEventListener("input", (e) => {
  renderHistoryList(e.target.value);
});
