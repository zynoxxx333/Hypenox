import { firebaseConfig, adminEmail } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

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

  let products = [];
  let currentAdmin = null;
  let selectedProduct = null;

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
    dialogContact: document.querySelector("#dialog-contact"),
    dialogDisclaimer: document.querySelector("#dialog-disclaimer"),
    adminDialog: document.querySelector("#admin-dialog"),
    adminLoginForm: document.querySelector("#admin-login-form"),
    adminEmail: document.querySelector("#admin-email"),
    adminLoginMessage: document.querySelector("#admin-login-message"),
    adminVerifyResend: document.querySelector("#admin-verify-resend"),
    adminWorkspace: document.querySelector("#admin-workspace"),
    adminSessionEmail: document.querySelector("#admin-session-email"),
    adminLogout: document.querySelector("#admin-logout"),
    adminForm: document.querySelector("#admin-form"),
    adminCategory: document.querySelector("#admin-category"),
    adminAccountFields: Array.from(document.querySelectorAll("[data-account-fields]")),
    adminRank: document.querySelector("#admin-rank"),
    adminTier: document.querySelector("#admin-tier"),
    adminPreview: document.querySelector("#admin-preview"),
    adminPreviewContent: document.querySelector("#admin-preview-content"),
    adminInventory: document.querySelector("#admin-inventory"),
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

  function isAdminUser(user) {
    return Boolean(
      user &&
      user.email &&
      user.email.toLocaleLowerCase("en-US") === adminEmail.toLocaleLowerCase("en-US") &&
      user.emailVerified
    );
  }

  function setAdminLoginMessage(message, showVerifyButton) {
    elements.adminLoginMessage.textContent = message;
    elements.adminVerifyResend.hidden = !showVerifyButton;
  }

  function updateAdminAccess() {
    const hasAdminAccess = isAdminUser(currentAdmin);
    elements.adminLoginForm.hidden = hasAdminAccess;
    elements.adminWorkspace.hidden = !hasAdminAccess;
    elements.adminEmail.value = adminEmail;

    if (hasAdminAccess) {
      elements.adminSessionEmail.textContent = currentAdmin.email;
      setAdminLoginMessage("Acesso restrito ao administrador.", false);
    }
  }

  function productCategoryLabel(category) {
    return category === "skins" ? "Skins" : "Contas";
  }

  function productRankLabel(product) {
    if (!product.rank) return "";
    const rank = rankNames.find(function (item) { return item.key === product.rank; });
    if (!rank) return "";
    if (product.rank === "radiante") return rank.name;
    const tier = product.tier ? " " + product.tier : "";
    return rank.name + tier;
  }

  function normalizeProduct(id, data) {
    return Object.assign({}, data, {
      id: id,
      categoryLabel: productCategoryLabel(data.category),
      rankLabel: productRankLabel(data),
      availability: data.status === "sold" ? "Indisponível" : "Disponível"
    });
  }

  async function loadProducts() {
    const productsRef = collection(db, "products");
    const productsQuery = currentAdmin
      ? productsRef
      : query(productsRef, where("published", "==", true));

    try {
      const snapshot = await getDocs(productsQuery);
      products = snapshot.docs.map(function (productDocument) {
        return normalizeProduct(productDocument.id, productDocument.data());
      });
      renderProducts();
      if (currentAdmin) renderAdminInventory();
    } catch (error) {
      products = [];
      renderProducts();
      showStatus("Não foi possível carregar o catálogo do Firebase. Verifique a configuração e as regras do Firestore.");
      console.error("Failed to load the public product catalog.", error);
    }
  }

  function authErrorMessage(errorCode) {
    const messages = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/invalid-email": "Informe um e-mail válido.",
      "auth/operation-not-allowed": "Ative o provedor E-mail/Senha no Firebase Authentication.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde antes de tentar novamente.",
      "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente."
    };
    return messages[errorCode] || "Não foi possível autenticar. Verifique o provedor de login no Firebase.";
  }

  function renderAdminInventory() {
    const rows = products.map(function (product) {
      const item = document.createElement("article");
      item.className = "admin-inventory-item";

      const details = document.createElement("div");
      details.className = "admin-inventory-details";
      const title = document.createElement("strong");
      title.textContent = product.name;
      const state = document.createElement("span");
      state.textContent = (product.published ? "Publicado" : "Oculto") + " · "
        + (product.status === "sold" ? "Vendido" : "Disponível");
      details.append(title, state);

      const actions = document.createElement("div");
      actions.className = "admin-inventory-actions";
      [
        { field: "status", value: product.status === "sold" ? "available" : "sold",
          label: product.status === "sold" ? "Reativar" : "Marcar vendido" },
        { field: "published", value: !product.published,
          label: product.published ? "Ocultar" : "Publicar" }
      ].forEach(function (action) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button-quiet";
        button.dataset.productId = product.id;
        button.dataset.field = action.field;
        button.dataset.value = String(action.value);
        button.textContent = action.label;
        actions.append(button);
      });

      item.append(details, actions);
      return item;
    });
    elements.adminInventory.replaceChildren.apply(elements.adminInventory, rows);
    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "admin-inventory-empty";
      empty.textContent = "Nenhum produto cadastrado.";
      elements.adminInventory.append(empty);
    }
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
    availability.textContent = product.status === "sold"
      ? "Indisponível"
      : product.checkoutUrl
        ? "Disponível para compra"
        : "Checkout pendente";

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
    button.setAttribute("aria-label", "Abrir painel administrativo");
    button.innerHTML = '<span class="admin-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg></span><strong>Painel administrativo</strong><span>Entre para cadastrar e gerenciar produtos</span>';
    button.addEventListener("click", openAdminDialog);
    return button;
  }

  function getVisibleProducts() {
    const query = elements.catalogSearch.value.trim().toLocaleLowerCase("pt-BR");
    const category = elements.category.querySelector("input:checked").value;
    const selectedRank = elements.rankTrack.dataset.selectedRank || "all";
    const matching = products.filter(function (product) {
      if (!product.published) return false;
      const matchesQuery = (product.name + " " + product.description + " " + product.categoryLabel)
        .toLocaleLowerCase("pt-BR")
        .includes(query);
      return matchesQuery
        && (category === "all" || product.category === category)
        && (selectedRank === "all" || product.rank === selectedRank.replace(/-(i{1,3})$/i, ""));
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
        elements.count.textContent = "Painel administrativo";
      } else {
        elements.count.textContent = "0 produtos publicados";
        elements.emptyTitle.textContent = "Nenhum produto publicado";
        elements.emptyDescription.textContent = "Os produtos aparecerão aqui assim que forem publicados pelo painel administrativo.";
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
    selectedProduct = product;
    elements.dialogCategory.textContent = product.categoryLabel.toLocaleUpperCase("pt-BR");
    elements.dialogTitle.textContent = product.name;
    elements.dialogDescription.textContent = product.description;
    elements.dialogPrice.textContent = currency.format(product.price);
    elements.dialogAvailability.textContent = product.status === "sold" ? "Produto indisponível" : "Produto disponível";
    if (product.status === "sold") {
      elements.dialogContact.textContent = "Produto indisponível";
      elements.dialogContact.disabled = true;
      elements.dialogDisclaimer.textContent = "Este produto não está disponível para compra.";
    } else if (product.checkoutUrl) {
      elements.dialogContact.textContent = "Ir ao checkout Kiwify";
      elements.dialogContact.disabled = false;
      elements.dialogDisclaimer.textContent = "Você será encaminhado ao checkout da Kiwify. O retorno do checkout não confirma pagamento nem entrega.";
    } else {
      elements.dialogContact.textContent = "Checkout pendente";
      elements.dialogContact.disabled = true;
      elements.dialogDisclaimer.textContent = "O link de checkout deste produto ainda não foi configurado.";
    }
    elements.dialog.showModal();
  }

  function openAdminDialog() {
    updateAdminAccess();
    elements.adminForm.reset();
    elements.adminCategory.value = "contas";
    elements.adminRank.value = rankNames[0].key;
    elements.adminTier.disabled = false;
    elements.adminTier.value = "1";
    updateAdminCategory();
    elements.adminPreview.hidden = true;
    elements.adminPreviewContent.textContent = "";
    elements.adminDialog.showModal();
    if (currentAdmin) loadProducts();
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
    if (isRadiant) elements.adminTier.value = "Único";
    else if (!["1", "2", "3"].includes(elements.adminTier.value)) elements.adminTier.value = "1";
  }

  function updateAdminCategory() {
    const isAccount = elements.adminCategory.value === "contas";
    elements.adminAccountFields.forEach(function (field) {
      const input = field.querySelector("input, select");
      field.hidden = !isAccount;
      input.required = isAccount && ["level", "rank", "tier"].includes(input.name);
      input.disabled = !isAccount;
    });
    updateAdminTier();
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
  elements.adminCategory.addEventListener("change", updateAdminCategory);
  elements.adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const formData = new FormData(elements.adminLoginForm);
    const email = String(formData.get("email")).trim().toLocaleLowerCase("en-US");
    const password = String(formData.get("password"));
    if (email !== adminEmail.toLocaleLowerCase("en-US")) {
      setAdminLoginMessage("Este painel é restrito ao e-mail administrador autorizado.", false);
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      elements.adminLoginForm.elements.password.value = "";
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        setAdminLoginMessage("Enviamos um link de verificação ao e-mail administrador. Verifique a caixa de entrada e clique em “Reenviar verificação de e-mail” após confirmar.", true);
        return;
      }
      currentAdmin = credential.user;
      updateAdminAccess();
      await loadProducts();
    } catch (error) {
      elements.adminLoginForm.elements.password.value = "";
      setAdminLoginMessage(authErrorMessage(error.code), false);
    }
  });
  elements.adminVerifyResend.addEventListener("click", async function () {
    const user = auth.currentUser;
    if (!user || user.email.toLocaleLowerCase("en-US") !== adminEmail.toLocaleLowerCase("en-US")) {
      setAdminLoginMessage("Entre com o e-mail administrador para verificar o acesso.", false);
      return;
    }

    try {
      await user.reload();
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        setAdminLoginMessage("Enviamos um novo link de verificação. Confira seu e-mail e tente novamente.", true);
        return;
      }
      await user.getIdToken(true);
      currentAdmin = user;
      updateAdminAccess();
      await loadProducts();
    } catch (error) {
      setAdminLoginMessage("Não foi possível verificar o e-mail. Tente novamente mais tarde.", true);
      console.error("Failed to refresh administrator verification.", error);
    }
  });
  elements.adminLogout.addEventListener("click", async function () {
    try {
      await signOut(auth);
      currentAdmin = null;
      updateAdminAccess();
      showStatus("Sessão administrativa encerrada.");
    } catch (error) {
      showStatus("Não foi possível encerrar a sessão. Tente novamente.");
      console.error("Failed to sign out the administrator.", error);
    }
  });
  elements.adminForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isAdminUser(currentAdmin)) {
      showStatus("Entre com a conta administradora para cadastrar produtos.");
      return;
    }
    if (!elements.adminForm.reportValidity()) return;

    const formData = new FormData(elements.adminForm);
    const category = String(formData.get("category"));
    const rank = category === "contas" ? String(formData.get("rank")) : "";
    const checkoutUrl = String(formData.get("checkoutUrl")).trim();
    if (checkoutUrl && new URL(checkoutUrl).protocol !== "https:") {
      showStatus("O link do checkout precisa usar HTTPS.");
      return;
    }

    const productData = {
      name: String(formData.get("name")).trim(),
      description: String(formData.get("description")).trim(),
      category: category,
      price: Number(formData.get("price")),
      rank: rank,
      tier: category !== "contas" ? "" : rank === "radiante" ? "Único" : String(formData.get("tier")),
      level: category !== "contas" ? 0 : Number(formData.get("level")),
      agents: category !== "contas" ? 0 : Number(formData.get("agents") || 0),
      cosmetics: category !== "contas" ? 0 : Number(formData.get("cosmetics") || 0),
      checkoutUrl: checkoutUrl,
      published: true,
      status: "available",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "products"), productData);
      elements.adminForm.reset();
      elements.adminCategory.value = "contas";
      elements.adminRank.value = rankNames[0].key;
      elements.adminTier.value = "1";
      updateAdminCategory();
      elements.adminPreviewContent.textContent = "O produto foi publicado e já está visível no catálogo.";
      elements.adminPreview.hidden = false;
      await loadProducts();
      showStatus("Produto publicado no catálogo.");
    } catch (error) {
      showStatus("Não foi possível publicar o produto. Confira as regras do Firestore e o acesso de administrador.");
      console.error("Failed to create a catalog product.", error);
    }
  });
  elements.adminInventory.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-product-id]");
    if (!button || !isAdminUser(currentAdmin)) return;
    const field = button.dataset.field;
    const value = field === "published" ? button.dataset.value === "true" : button.dataset.value;

    try {
      await updateDoc(doc(db, "products", button.dataset.productId), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      await loadProducts();
      showStatus("Produto atualizado.");
    } catch (error) {
      showStatus("Não foi possível atualizar o produto. Tente novamente.");
      console.error("Failed to update a catalog product.", error);
    }
  });
  onAuthStateChanged(auth, function (user) {
    currentAdmin = isAdminUser(user) ? user : null;
    updateAdminAccess();
    if (user && user.email && user.email.toLocaleLowerCase("en-US") !== adminEmail.toLocaleLowerCase("en-US")) {
      signOut(auth).catch(function (error) {
        console.error("Failed to reject a non-administrator session.", error);
      });
    } else if (user && !user.emailVerified) {
      setAdminLoginMessage("O e-mail administrador precisa ser verificado antes de acessar o painel.", true);
    }
    loadProducts();
  }, function (error) {
    showStatus("Não foi possível confirmar a sessão administrativa.");
    console.error("Failed to observe Firebase Authentication state.", error);
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
  elements.dialogContact.addEventListener("click", function () {
    if (!selectedProduct || selectedProduct.status === "sold" || !selectedProduct.checkoutUrl) return;
    const checkoutUrl = new URL(selectedProduct.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") {
      showStatus("O link de checkout não é seguro. Avise o atendimento.");
      return;
    }
    window.open(checkoutUrl.href, "_blank", "noopener,noreferrer");
    elements.dialog.close();
    showStatus("Checkout aberto. A confirmação do pagamento depende da Kiwify.");
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
  elements.adminEmail.value = adminEmail;
  elements.adminEmail.readOnly = true;
  initializeAdminForm();
  updateAdminCategory();
  renderRanks();
  renderProducts();
  updateNavigation();
}());
