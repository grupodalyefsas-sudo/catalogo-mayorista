
const el = id => document.getElementById(id);

const grid = el("productGrid");
const nav = el("categoryNav");
const mobileCategories = el("mobileCategories");
const categoryCards = el("categoryCards");
const productCount = el("productCount");
const heroCount = el("heroCount");
const sectionTitle = el("sectionTitle");
const emptyState = el("emptyState");
const syncStatus = el("syncStatus");
const desktopSearch = el("desktopSearch");
const mobileSearch = el("mobileSearch");
const inlineSearch = el("inlineSearch");
const modal = el("productModal");
const modalImage = el("modalImage");
const modalThumbs = el("modalThumbs");
const modalDots = el("modalDots");
const modalCategory = el("modalCategory");
const modalRef = el("modalRef");
const modalName = el("modalName");
const modalPrice = el("modalPrice");
const prevPhoto = el("prevPhoto");
const nextPhoto = el("nextPhoto");
const searchSuggestions = el("searchSuggestions");
const mobileMenu = el("mobileMenu");
const menuBackdrop = el("menuBackdrop");

let products = [];
let activeCategory = "Todos";
let query = "";
let currentPhotos = [];
let currentPhotoIndex = 0;

const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const money = value => {
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(number) || number <= 0) return "Precio pendiente";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(number);
};

function parseGviz(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start < 0 || end <= start) throw new Error("Respuesta inválida de Google Sheets");

  const data = JSON.parse(text.slice(start, end));
  const cols = data.table.cols.map(c => normalize(c.label));

  const findColumn = aliases => {
    for (const alias of aliases) {
      const index = cols.findIndex(c => c === normalize(alias));
      if (index >= 0) return index;
    }
    return -1;
  };

  const refCol = findColumn(["Referencia", "Refetencia", "Código", "Codigo", "SKU"]);
  const nameCol = findColumn(["Nombre", "Producto"]);
  const categoryCol = findColumn(["Categoría", "Categoria"]);
  const priceCol = findColumn(["Precio", "Precio mayorista"]);
  const photo1Col = findColumn(["Foto 1", "Foto1"]);
  const photo2Col = findColumn(["Foto 2", "Foto2"]);
  const photo3Col = findColumn(["Foto 3", "Foto3"]);

  if (refCol < 0) throw new Error("No se encontró la columna Referencia");

  return data.table.rows.map(row => {
    const cells = row.c || [];
    const read = index => index >= 0 && cells[index] ? (cells[index].v ?? "") : "";

    const referencia = String(read(refCol)).trim();
    if (!referencia) return null;

    return {
      referencia,
      nombre: String(read(nameCol)).trim() || referencia,
      categoria: String(read(categoryCol)).trim() || "Otros",
      precio: read(priceCol),
      fotos: [
        String(read(photo1Col)).trim(),
        String(read(photo2Col)).trim(),
        String(read(photo3Col)).trim()
      ].filter(Boolean)
    };
  }).filter(Boolean);
}

async function loadProducts(showLoading = true) {
  if (showLoading) {
    syncStatus.textContent = "Actualizando catálogo…";
    syncStatus.className = "";
  }

  try {
const url = `https://docs.google.com/spreadsheets/d/${CATALOG_CONFIG.sheetId}/gviz/tq?tqx=out:json&gid=${CATALOG_CONFIG.sheetGid}&headers=1&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer Google Sheets");

    products = parseGviz(await response.text());

    syncStatus.textContent = "Catálogo actualizado";
    syncStatus.className = "ok";
    heroCount.textContent = products.length;

    renderAll();
  } catch (error) {
    console.error(error);
    syncStatus.textContent = "No fue posible actualizar";
    syncStatus.className = "error";

    if (!products.length) {
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent = "No pudimos cargar el catálogo";
      emptyState.querySelector("p").textContent = "Verifica que la hoja esté compartida como cualquier persona con el enlace.";
    }
  }
}

function categories() {
  return ["Todos", ...new Set(
    products.map(p => p.categoria).filter(Boolean).sort((a,b) => a.localeCompare(b, "es"))
  )];
}

function setCategory(category) {
  activeCategory = category;
  sectionTitle.textContent = category === "Todos" ? "Todos los productos" : category;
  renderAll();
  el("productos").scrollIntoView({ behavior: "smooth" });
  closeMenu();
}

function renderCategoryNav() {
  const markup = categories().map(category => `
    <button class="category-btn ${category === activeCategory ? "active" : ""}" data-category="${category}">
      ${category}
    </button>
  `).join("");

  nav.innerHTML = markup;
  mobileCategories.innerHTML = markup;

  [nav, mobileCategories].forEach(container => {
    container.querySelectorAll("[data-category]").forEach(button => {
      button.addEventListener("click", () => setCategory(button.dataset.category));
    });
  });
}

function renderCategoryCards() {
  const list = categories().filter(c => c !== "Todos").slice(0, 8);

  categoryCards.innerHTML = list.map((category, index) => {
    const total = products.filter(p => p.categoria === category).length;
    return `
      <button class="category-card" data-category="${category}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${category}</strong>
        <small>${total} productos</small>
      </button>
    `;
  }).join("");

  categoryCards.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });
}

function visibleProducts() {
  const term = normalize(query);

  return products.filter(product => {
    const categoryMatch = activeCategory === "Todos" || product.categoria === activeCategory;
    const searchText = normalize(`${product.referencia} ${product.nombre} ${product.categoria}`);
    return categoryMatch && searchText.includes(term);
  });
}

function renderProducts() {
  const list = visibleProducts();
  productCount.textContent = list.length;

  grid.innerHTML = list.map((product, index) => `
    <article class="product-card" style="animation-delay:${Math.min(index * 25, 300)}ms" tabindex="0" data-ref="${product.referencia}">
      <div class="product-image-wrap">
        <img
          class="product-image"
          src="${product.fotos[0] || CATALOG_CONFIG.placeholder}"
          alt="${product.nombre} ${product.referencia}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${CATALOG_CONFIG.placeholder}'"
        >
        <span class="product-index">${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="product-info">
        <h3 class="product-ref">${product.referencia}</h3>
        <p class="product-name">${product.nombre}</p>
        <p class="product-price ${product.precio ? "" : "pending"}">${money(product.precio)}</p>
      </div>
    </article>
  `).join("");

  emptyState.hidden = list.length > 0;
  renderSuggestions(list);

  grid.querySelectorAll(".product-card").forEach(card => {
    const open = () => openProduct(card.dataset.ref);
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderSuggestions(list) {
  const term = normalize(query);

  if (!term || !list.length) {
    searchSuggestions.hidden = true;
    searchSuggestions.innerHTML = "";
    return;
  }

  const categoryMatches = [...new Set(list.map(p => p.categoria))].slice(0, 4);
  const productMatches = list.slice(0, 6);

  searchSuggestions.innerHTML = `
    <h4>RESULTADOS RÁPIDOS</h4>
    <div class="suggestion-list">
      ${categoryMatches.map(c => `<button class="suggestion-chip" data-category="${c}">${c}</button>`).join("")}
      ${productMatches.map(p => `<button class="suggestion-chip" data-ref="${p.referencia}">${p.referencia}</button>`).join("")}
    </div>
  `;
  searchSuggestions.hidden = false;

  searchSuggestions.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });

  searchSuggestions.querySelectorAll("[data-ref]").forEach(button => {
    button.addEventListener("click", () => openProduct(button.dataset.ref));
  });
}

function showPhoto(index) {
  if (!currentPhotos.length) return;

  currentPhotoIndex = (index + currentPhotos.length) % currentPhotos.length;
  modalImage.classList.add("switching");

  setTimeout(() => {
    modalImage.src = currentPhotos[currentPhotoIndex];
    modalImage.classList.remove("switching");
  }, 100);

  modalThumbs.querySelectorAll("button").forEach((button, i) => {
    button.classList.toggle("active", i === currentPhotoIndex);
  });

  modalDots.querySelectorAll("button").forEach((button, i) => {
    button.classList.toggle("active", i === currentPhotoIndex);
  });

  prevPhoto.disabled = currentPhotos.length <= 1;
  nextPhoto.disabled = currentPhotos.length <= 1;
}

function openProduct(ref) {
  const product = products.find(p => p.referencia === ref);
  if (!product) return;

  modalCategory.textContent = product.categoria;
  modalRef.textContent = product.referencia;
  modalName.textContent = product.nombre;
  modalPrice.textContent = money(product.precio);

  currentPhotos = product.fotos.length ? product.fotos : [CATALOG_CONFIG.placeholder];
  currentPhotoIndex = 0;

  modalThumbs.innerHTML = currentPhotos.map((photo, index) => `
    <button class="${index === 0 ? "active" : ""}" data-index="${index}">
      <img src="${photo}" alt="Foto ${index + 1}" onerror="this.src='${CATALOG_CONFIG.placeholder}'">
    </button>
  `).join("");

  modalDots.innerHTML = currentPhotos.map((_, index) => `
    <button class="modal-dot ${index === 0 ? "active" : ""}" data-index="${index}" aria-label="Ver foto ${index + 1}"></button>
  `).join("");

  modalThumbs.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => showPhoto(Number(button.dataset.index)));
  });

  modalDots.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => showPhoto(Number(button.dataset.index)));
  });

  showPhoto(0);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setSearch(value) {
  query = value;
  desktopSearch.value = value;
  mobileSearch.value = value;
  inlineSearch.value = value;
  renderProducts();
}

function openMenu() {
  mobileMenu.classList.add("open");
  menuBackdrop.classList.add("open");
}

function closeMenu() {
  mobileMenu.classList.remove("open");
  menuBackdrop.classList.remove("open");
}

function renderAll() {
  renderCategoryNav();
  renderCategoryCards();
  renderProducts();
}

[desktopSearch, mobileSearch, inlineSearch].forEach(input => {
  input.addEventListener("input", event => setSearch(event.target.value));
});

document.querySelectorAll("[data-close-modal]").forEach(node => {
  node.addEventListener("click", closeModal);
});

prevPhoto.addEventListener("click", () => showPhoto(currentPhotoIndex - 1));
nextPhoto.addEventListener("click", () => showPhoto(currentPhotoIndex + 1));

let touchStartX = 0;
modalImage.addEventListener("touchstart", event => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

modalImage.addEventListener("touchend", event => {
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) < 45) return;
  showPhoto(currentPhotoIndex + (distance < 0 ? 1 : -1));
}, { passive: true });

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeMenu();
  }
});

el("mobileMenuBtn").addEventListener("click", openMenu);
el("closeMenuBtn").addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);

loadProducts();

setInterval(() => {
  loadProducts(false);
}, CATALOG_CONFIG.refreshMinutes * 60 * 1000);
