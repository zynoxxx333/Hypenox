(function () {
  "use strict";

  const rankNames = [
    { name: "Ferro", key: "ferro", image: "ferro-3.webp" },
    { name: "Bronze", key: "bronze", image: "bronze-3.webp" },
    { name: "Prata", key: "prata", image: "prata-3.webp" },
    { name: "Ouro", key: "ouro", image: "ouro-3.webp" },
    { name: "Platina", key: "platina", image: "platina-3.webp" },
    { name: "Diamante", key: "diamante", image: "diamante-3.webp" },
    { name: "Ascendente", key: "ascendente", image: "ascendente-3.webp" },
    { name: "Imortal", key: "imortal", image: "imortal-3.webp" },
    { name: "Radiante", key: "radiante", image: "radiante.webp" }
  ];

  const ranks = rankNames.flatMap(function (rank) {
    const tiers = rank.key === "radiante" ? [null] : ["III"];
    return tiers.map(function (tier) {
      return {
        key: rank.key + (tier ? "-" + tier.toLowerCase() : ""),
        name: rank.name,
        image: rank.image,
        tier: tier,
        label: rank.name
      };
    });
  });

  const products = [];

  const elements = {
    headerSearch: document.querySelector("#header-search"),
    headerSearchForm: document.querySelector("#header-search-form"),
    catalogSearch: document.querySelector("#catalog-search"),
    category: document.querySelector(".category-filter-list"),
    sort: document.querySelector("#sort-filter"),
    rankTrack: document.querySelector("#rank-track"),
    clear: document.querySelector("#clear-filters"),
    emptyClear: document.querySelector("#empty-clear"),
    grid: document.querySelector("#product-grid"),
    empty: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyDescription: document.querySelector("#empty-description"),
    count: document.querySelector("#results-count"),
    dialog: document.querySelector("#product-dialog"),
    dialogCategory: document.querySelector("#dialog-category"),
    dialogTitle: document.querySelector("#dialog-title"),
    dialogDescription: document.querySelector("#dialog-description"),
    dialogPrice: document.querySelector("#dialog-price"),
    dialogAvailability: document.querySelector("#dialog-availability"),
    adminDialog: document.querySelector("#admin-dialog"),
    adminForm: document.querySelector("#admin-form"),
    adminRank: document.querySelector("#admin-rank"),
    adminTier: document.querySelector("#admin-tier"),
    adminPreview: document.querySelector("#admin-preview"),
    adminPreviewContent: document.querySelector("#admin-preview-content"),
    status: document.querySelector("#status-message"),
    menuToggle: document.querySelector("#menu-toggle"),
    nav: document.querySelector("#primary-nav")
  };

  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
  let statusTimer;
  let adminEntryEnabled = false;

  function showStatus(message) {
    window.clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.classList.add("is-visible");
    statusTimer = window.setTimeout(function () {
      elements.status.classList.remove("is-visible");
    }, 4200);
  }

  function productCard(product) {
    const article = document.createElement("article");
    article.className = "product-card";

    const visual = document.createElement("div");
    visual.className = "product-visual";
    visual.setAttribute("aria-hidden", "true");
    const visualLabel = document.createElement("span");
    visualLabel.textContent = "IMAGEM DO PRODUTO";
    visual.append(visualLabel);

    const content = document.createElement("div");
    content.className = "product-content";

    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.categoryLabel;

    const title = document.createElement("h3");
    title.textContent = product.name;
    if (product.rankLabel) {
      const rankTag = document.createElement("span");
      rankTag.className = "product-rank";
      rankTag.textContent = product.rankLabel;
      category.append(" · ", rankTag);
    }

    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.description;

    const footer = document.createElement("div");
    footer.className = "product-footer";
    const price = document.createElement("strong");
    price.className = "product-price";
    price.textContent = currency.format(product.price);
    const availability = document.createElement("span");
    availability.className = "product-availability";
    availability.textContent = product.availability || "Disponibilidade a confirmar";

    const details = document.createElement("button");
    details.type = "button";
    details.className = "button button-card";
    details.textContent = "Ver detalhes";
    details.setAttribute("aria-label", "Ver detalhes de " + product.name);
    details.addEventListener("click", function () {
      openProduct(product);
    });

    footer.append(price, availability);
    content.append(category, title, description, footer, details);
    article.append(visual, content);
    return article;
  }

  function adminEntryCard() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-entry-card";
    button.setAttribute("aria-label", "Abrir painel local de cadastro de conta");
    button.innerHTML = '<span class="admin-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg></span><strong>Cadastrar conta</strong><span>Adicionar características e gerar uma prévia local</span>';
    button.addEventListener("click", openAdminDialog);
    return button;
  }

  function getVisibleProducts() {
    const query = elements.catalogSearch.value.trim().toLocaleLowerCase("pt-BR");
    const category = elements.category.querySelector("input:checked").value;
    const selectedRank = elements.rankTrack.dataset.selectedRank || "all";
    const matching = products.filter(function (product) {
      const matchesQuery = (product.name + " " + product.description + " " + product.categoryLabel)
        .toLocaleLowerCase("pt-BR")
        .includes(query);
      return matchesQuery
        && (category === "all" || product.category === category)
        && (selectedRank === "all" || product.rank === selectedRank);
    });

    if (elements.sort.value === "price-asc") {
      matching.sort(function (a, b) { return a.price - b.price; });
    } else if (elements.sort.value === "price-desc") {
      matching.sort(function (a, b) { return b.price - a.price; });
    }
    return matching;
  }

  function renderProducts() {
    const visibleProducts = getVisibleProducts();
    const query = elements.catalogSearch.value.trim();
    const showAdminEntry = adminEntryEnabled
      && !query
      && elements.category.querySelector("input:checked").value === "contas";
    const cards = visibleProducts.map(productCard);
    if (showAdminEntry) cards.unshift(adminEntryCard());
    elements.grid.replaceChildren.apply(elements.grid, cards);
    elements.empty.hidden = cards.length > 0;
    elements.emptyClear.hidden = products.length === 0;
    if (products.length === 0) {
      if (showAdminEntry) {
        elements.count.textContent = "Painel de cadastro local";
      } else {
        elements.count.textContent = "0 produtos cadastrados";
        elements.emptyTitle.textContent = "Estamos preparando o catálogo";
        elements.emptyDescription.textContent = "Produtos, preços e disponibilidade serão publicados após cadastro e validação. As compras ainda não estão habilitadas.";
      }
    } else {
      elements.count.textContent = visibleProducts.length + (visibleProducts.length === 1 ? " produto encontrado" : " produtos encontrados");
      elements.emptyTitle.textContent = "Nenhum resultado";
      elements.emptyDescription.textContent = "Não encontramos produtos com esses filtros. Ajuste a busca ou limpe os filtros.";
    }
  }

  function scrollToCatalog() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector("#catalogo").scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }

  function renderRanks() {
    elements.rankTrack.dataset.selectedRank = "all";
    ranks.forEach(function (rank) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rank-option";
      button.dataset.rank = rank.key;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Selecionar rank " + rank.name);

      const art = document.createElement("span");
      art.className = "rank-art";
      const image = document.createElement("img");
      image.className = "rank-image";
      image.src = "public/images/ranks/" + rank.image;
      image.alt = "Ícone do rank " + rank.name + " de VALORANT";
      image.width = 64;
      image.height = 64;
      image.decoding = "async";
      image.draggable = false;
      art.append(image);

      const label = document.createElement("strong");
      label.textContent = rank.name;
      const tier = document.createElement("small");
      tier.textContent = rank.tier ? "Tier " + rank.tier : "Único";
      button.append(art, label, tier);
      elements.rankTrack.append(button);
    });
  }

  function clearFilters() {
    adminEntryEnabled = false;
    elements.catalogSearch.value = "";
    elements.headerSearch.value = "";
    elements.category.querySelector('input[value="all"]').checked = true;
    elements.sort.value = "featured";
    elements.rankTrack.dataset.selectedRank = "all";
    elements.rankTrack.querySelectorAll(".rank-option").forEach(function (option) {
      option.classList.remove("is-selected");
      option.setAttribute("aria-pressed", "false");
    });
    document.querySelectorAll(".side-category").forEach(function (button) {
      const selected = button.dataset.category === "all";
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  }

  function openProduct(product) {
    elements.dialogCategory.textContent = product.categoryLabel.toLocaleUpperCase("pt-BR");
    elements.dialogTitle.textContent = product.name;
    elements.dialogDescription.textContent = product.description;
    elements.dialogPrice.textContent = currency.format(product.price);
    elements.dialogAvailability.textContent = product.availability;
    elements.dialog.showModal();
  }

  function openAdminDialog() {
    elements.adminForm.reset();
    elements.adminRank.value = rankNames[0].key;
    elements.adminTier.disabled = false;
    elements.adminTier.value = "1";
    elements.adminPreview.hidden = true;
    elements.adminPreviewContent.textContent = "";
    elements.adminDialog.showModal();
  }

  function activateAdminShortcut(value) {
    if (value.trim().toLocaleLowerCase("pt-BR") !== "x26admin") return false;

    adminEntryEnabled = true;
    elements.headerSearch.value = "";
    elements.catalogSearch.value = "";
    elements.category.querySelector('input[value="contas"]').checked = true;
    document.querySelectorAll(".side-category").forEach(function (button) {
      const selected = button.dataset.category === "contas";
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    elements.rankTrack.dataset.selectedRank = "all";
    elements.rankTrack.querySelectorAll(".rank-option").forEach(function (option) {
      option.classList.remove("is-selected");
      option.setAttribute("aria-pressed", "false");
    });
    renderProducts();
    scrollToCatalog();
    return true;
  }

  function initializeAdminForm() {
    rankNames.forEach(function (rank) {
      const option = document.createElement("option");
      option.value = rank.key;
      option.textContent = rank.name;
      elements.adminRank.append(option);
    });
  }

  function updateAdminTier() {
    const isRadiant = elements.adminRank.value === "radiante";
    elements.adminTier.disabled = isRadiant;
    if (isRadiant) elements.adminTier.value = "";
    else if (!["1", "2", "3"].includes(elements.adminTier.value)) elements.adminTier.value = "1";
  }

  function configuredWhatsappPhone() {
    const config = window.HIPENOX_CONFIG;
    return config && typeof config.whatsappPhone === "string"
      ? config.whatsappPhone.replace(/\D/g, "")
      : "";
  }

  function contact(productName) {
    const config = window.HIPENOX_CONFIG;
    const phone = configuredWhatsappPhone();

    if (!phone) {
      showStatus("Atendimento via WhatsApp pendente de configuração. Nenhuma mensagem foi enviada.");
      return;
    }

    const message = productName
      ? "Olá! Gostaria de consultar a disponibilidade de: " + productName + "."
      : "Olá! Gostaria de falar com a Hipenox.";
    const url = config.whatsappBaseUrl + phone + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  elements.headerSearch.addEventListener("input", function () {
    elements.catalogSearch.value = elements.headerSearch.value;
    renderProducts();
  });

  elements.headerSearchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (activateAdminShortcut(elements.headerSearch.value)) return;
    elements.catalogSearch.value = elements.headerSearch.value;
    renderProducts();
    scrollToCatalog();
  });

  elements.catalogSearch.addEventListener("input", function () {
    elements.headerSearch.value = elements.catalogSearch.value;
    renderProducts();
  });
  elements.catalogSearch.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (activateAdminShortcut(elements.catalogSearch.value)) return;
      renderProducts();
    }
  });
  elements.adminRank.addEventListener("change", updateAdminTier);
  elements.adminForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!elements.adminForm.reportValidity()) return;

    const formData = new FormData(elements.adminForm);
    const rank = rankNames.find(function (item) { return item.key === formData.get("rank"); });
    const tier = elements.adminTier.disabled ? "Único" : formData.get("tier");
    const price = currency.format(Number(formData.get("price")));
    const agents = formData.get("agents") || "Não informado";
    const cosmetics = formData.get("cosmetics") || "Não informado";
    const summary = [
      String(formData.get("name")).trim(),
      "Patente: " + rank.name + (tier === "Único" ? "" : " " + tier),
      "Nível: " + formData.get("level"),
      "Preço informado: " + price,
      "Agentes desbloqueados: " + agents,
      "Itens cosméticos: " + cosmetics,
      "Descrição: " + String(formData.get("description")).trim(),
      "Prévia temporária: nada foi salvo, publicado ou enviado."
    ];
    elements.adminPreviewContent.textContent = summary.join("\n");
    elements.adminPreview.hidden = false;
  });
  document.querySelector("#admin-close").addEventListener("click", function () {
    elements.adminDialog.close();
  });
  elements.adminDialog.addEventListener("click", function (event) {
    if (event.target === elements.adminDialog) elements.adminDialog.close();
  });
  elements.adminDialog.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      elements.adminDialog.close();
    }
  });
  document.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
  document.addEventListener("dragstart", function (event) {
    if (event.target.closest("img")) event.preventDefault();
  });
  elements.category.addEventListener("change", function (event) {
    if (event.target.matches('input[name="category-filter"]')) {
      document.querySelectorAll(".side-category").forEach(function (button) {
        const selected = button.dataset.category === event.target.value;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderProducts();
    }
  });
  document.querySelectorAll(".side-category").forEach(function (button) {
    button.addEventListener("click", function () {
      const radio = elements.category.querySelector('input[value="' + button.dataset.category + '"]');
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      scrollToCatalog();
    });
  });
  elements.rankTrack.addEventListener("click", function (event) {
    const option = event.target.closest(".rank-option");
    if (!option) return;
    elements.rankTrack.dataset.selectedRank = option.dataset.rank;
    elements.rankTrack.querySelectorAll(".rank-option").forEach(function (rankOption) {
      const selected = rankOption === option;
      rankOption.classList.toggle("is-selected", selected);
      rankOption.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  });
  elements.sort.addEventListener("change", renderProducts);
  elements.clear.addEventListener("click", clearFilters);
  elements.emptyClear.addEventListener("click", clearFilters);
  document.querySelector("#view-all").addEventListener("click", function (event) {
    event.preventDefault();
    clearFilters();
  });

  document.querySelector("#dialog-close").addEventListener("click", function () {
    elements.dialog.close();
  });
  elements.dialog.addEventListener("click", function (event) {
    if (event.target === elements.dialog) {
      elements.dialog.close();
    }
  });
  document.querySelector("#dialog-contact").addEventListener("click", function () {
    elements.dialog.close();
    showStatus("Pedidos ainda indisponíveis. O checkout permanece em configuração.");
  });

  ["#header-contact", "#footer-contact"].forEach(function (selector) {
    document.querySelector(selector).addEventListener("click", function () {
      contact("");
    });
  });
  document.querySelector("#header-cart").addEventListener("click", function () {
    showStatus("O checkout ainda está em configuração. Nenhum pedido foi criado.");
  });
  document.querySelector("#footer-contact").textContent = configuredWhatsappPhone()
    ? "Falar pelo WhatsApp"
    : "WhatsApp pendente de configuração";

  elements.menuToggle.addEventListener("click", function () {
    const isExpanded = elements.menuToggle.getAttribute("aria-expanded") === "true";
    elements.menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    elements.menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
    elements.nav.classList.toggle("is-open", !isExpanded);
  });
  elements.nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.menuToggle.setAttribute("aria-label", "Abrir menu");
      elements.nav.classList.remove("is-open");
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && elements.menuToggle.getAttribute("aria-expanded") === "true") {
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.menuToggle.setAttribute("aria-label", "Abrir menu");
      elements.nav.classList.remove("is-open");
      elements.menuToggle.focus();
    }
  });

  const pageSections = Array.from(document.querySelectorAll("main > section[id], .site-footer[id]"));
  const sidebarTargets = { patentes: "catalogo", pagamentos: "sobre" };
  const headerTargets = { sobre: "pagamentos", contato: "pagamentos" };

  function updateNavigation() {
    const threshold = document.querySelector(".site-header").getBoundingClientRect().bottom + 24;
    const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let activeSection = pageSections[0];
    pageSections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= threshold) activeSection = section;
    });

    [
      { links: document.querySelectorAll(".side-nav a"), aliases: sidebarTargets },
      { links: elements.nav.querySelectorAll("a"), aliases: headerTargets }
    ].forEach(function (navigation) {
      const currentHash = atPageBottom && Array.from(navigation.links).some(function (link) {
        return link.hash === window.location.hash;
      }) ? window.location.hash.slice(1) : null;
      const activeTarget = currentHash || navigation.aliases[activeSection.id] || activeSection.id;
      navigation.links.forEach(function (link) {
        const selected = link.hash === "#" + activeTarget;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    });
  }

  let navigationFrame = 0;
  window.addEventListener("scroll", function () {
    if (navigationFrame) return;
    navigationFrame = window.requestAnimationFrame(function () {
      navigationFrame = 0;
      updateNavigation();
    });
  }, { passive: true });
  window.addEventListener("resize", updateNavigation, { passive: true });
  window.addEventListener("hashchange", updateNavigation);

  document.querySelector("#current-year").textContent = String(new Date().getFullYear());
  initializeAdminForm();
  updateAdminTier();
  renderRanks();
  renderProducts();
  updateNavigation();
}());
