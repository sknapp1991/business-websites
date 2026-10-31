
const PAGE_SIZE = 8;
let visibleCount = 0;
let activeCategory = "All";
let activeSort = "relevance";

const CATEGORY_ICON = {
  "Women's": "\u{1F457}",
  "Men's": "\u{1F454}",
  "Kids": "\u{1F9F8}",
  "Electronics": "\u{1F4F1}",
  "Books & Media": "\u{1F4DA}",
  "Hobbies & Collectibles": "\u{1F3B4}"
};
const CATEGORY_GRADIENT = {
  "Women's": ["#241f26", "#1b1c22"],
  "Men's": ["#20262b", "#1b1c22"],
  "Kids": ["#241f26", "#1b1c22"],
  "Electronics": ["#1f2126", "#1b1c22"],
  "Books & Media": ["#23261f", "#1b1c22"],
  "Hobbies & Collectibles": ["#241f26", "#1b1c22"]
};

function venmoLink(product) {
  const note = encodeURIComponent(`${product.name} - ${STORE.brandNote}`);
  return `https://venmo.com/${STORE.venmoUsername}?txn=pay&amount=${product.price}&note=${note}`;
}

function cashAppLink(product) {
  return `https://cash.app/$${STORE.cashtag}/${product.price}`;
}

function askLink(product) {
  const subject = encodeURIComponent(`Question about: ${product.name}`);
  const body = encodeURIComponent(`Hi! I had a question about "${product.name}" ($${product.price}).\n\n`);
  return `mailto:${STORE.contactEmail}?subject=${subject}&body=${body}`;
}

function productCardHTML(p) {
  const [a, b] = CATEGORY_GRADIENT[p.category] || CATEGORY_GRADIENT.clothing;
  const photo = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
    : `<div class="placeholder-icon">${CATEGORY_ICON[p.category] || "\u{1F6CD}"}</div><span class="placeholder-label">Photo coming soon</span>`;

  const tags = [p.tag, p.brand, p.size ? `Size ${p.size}` : "", p.condition].filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`).join("");

  const noPrice = !p.price || p.price <= 0;
  const soldRibbon = p.sold ? `<span class="sold-ribbon">Sold</span>` : "";
  const disabled = (p.sold || noPrice) ? "disabled" : "";
  const reserveAttr = disabled ? "" : ` onclick="reserveItem('${p.id}')"`;
  const priceText = noPrice ? "Price TBD" : `$${p.price}`;

  return `
    <article class="product-card" data-id="${p.id}">
      <div class="product-photo ${p.image ? "" : "placeholder"}" style="--ph-a:${a};--ph-b:${b}">
        ${photo}
        ${soldRibbon}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-tags">${tags}</div>
        <p class="product-desc">${p.description}</p>
        <div class="product-price">${priceText}</div>
        <div class="buy-row">
          <a class="btn btn-sm btn-venmo btn-block" ${disabled}${reserveAttr} href="${disabled ? "#" : venmoLink(p)}" target="_blank" rel="noopener">Venmo</a>
          <a class="btn btn-sm btn-cashapp btn-block" ${disabled}${reserveAttr} href="${disabled ? "#" : cashAppLink(p)}" target="_blank" rel="noopener">Cash App</a>
        </div>
        <a class="ask-link" href="${askLink(p)}">Message about this item</a>
      </div>
    </article>`;
}

function vintedItemId(product) {
  const m = product.vintedUrl.match(/\/items\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function getFilteredProducts() {
  let list = PRODUCTS.filter(p => !p.sold);
  if (activeCategory !== "All") list = list.filter(p => p.category === activeCategory);

  if (activeSort === "price-desc") {
    list.sort((a, b) => b.price - a.price);
  } else if (activeSort === "price-asc") {
    list.sort((a, b) => a.price - b.price);
  } else if (activeSort === "newest") {
    list.sort((a, b) => vintedItemId(b) - vintedItemId(a));
  }
  // "relevance" keeps the original catalog order

  return list;
}

function renderGrid() {
  const grid = document.getElementById("product-grid");
  const filtered = getFilteredProducts();
  const slice = filtered.slice(0, visibleCount);
  grid.innerHTML = slice.map(productCardHTML).join("");
  renderGridFooter(filtered);

  const countEl = document.getElementById("filter-count");
  if (countEl) {
    countEl.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;
  }
}

function renderGridFooter(filtered) {
  let footer = document.getElementById("grid-footer");
  if (!footer) {
    footer = document.createElement("div");
    footer.id = "grid-footer";
    footer.className = "grid-footer";
    document.getElementById("product-grid").insertAdjacentElement("afterend", footer);
  }

  if (filtered.length === 0) {
    footer.innerHTML = `<p class="grid-end-msg">No items match these filters yet &mdash; try a different combination.</p>`;
  } else if (visibleCount >= filtered.length) {
    footer.innerHTML = `
      <p class="grid-end-msg">That's everything for this filter &mdash; check back soon for more drops.</p>
      <a class="btn btn-accent" href="${STORE.vintedUrl}" target="_blank" rel="noopener">Shop All Items on Vinted</a>`;
  } else {
    footer.innerHTML = `<button id="load-more-btn" class="btn btn-ghost">Load More</button>`;
    document.getElementById("load-more-btn").addEventListener("click", () => {
      visibleCount = Math.min(visibleCount + PAGE_SIZE, filtered.length);
      renderGrid();
    });
  }
}

function updateCategoryCounts() {
  const available = PRODUCTS.filter(p => !p.sold);
  const counts = { All: available.length };
  available.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  document.querySelectorAll(".opt-count").forEach(el => {
    const key = el.dataset.count;
    el.textContent = counts[key] ? counts[key] : "0";
  });
}

function setupDropdown(id, onSelect) {
  const dropdown = document.getElementById(id);
  const trigger = dropdown.querySelector(".dropdown-trigger");
  const panel = dropdown.querySelector(".dropdown-panel");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = dropdown.classList.contains("open");
    document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
    if (!wasOpen) dropdown.classList.add("open");
  });

  panel.querySelectorAll(".dropdown-option").forEach(opt => {
    opt.addEventListener("click", () => {
      panel.querySelectorAll(".dropdown-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      dropdown.classList.remove("open");
      onSelect(opt.dataset.value, opt.textContent.trim());
    });
  });
}

function setupFilters() {
  setupDropdown("category-dropdown", (value) => {
    activeCategory = value;
    document.getElementById("category-label").textContent = value;
    visibleCount = PAGE_SIZE;
    renderGrid();
  });

  setupDropdown("sort-dropdown", (value, label) => {
    activeSort = value;
    document.getElementById("sort-label").textContent = label;
    visibleCount = PAGE_SIZE;
    renderGrid();
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  visibleCount = PAGE_SIZE;
  updateCategoryCounts();
  setupFilters();
  renderGrid();
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
