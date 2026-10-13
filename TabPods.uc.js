// ==UserScript==
// @name            TabPods
// @description     Collapsible colored tab groups (pods) that can also hold pinned tabs
// @include         main
// @version         1.0.0
// @author          buinsky
// @homepageURL     https://github.com/buinsky/TabPods
// ==/UserScript==

// A pod is a set of tabs marked with the same id. A colored capsule is inserted
// into the tab strip right before the pod's first tab; clicking it hides or
// shows all tabs of the pod, pinned ones included.
//
// Firefox treats every child of the tab containers as a tab, so allTabs is
// wrapped to filter the capsules out. Tabs are hidden with the regular "hidden"
// attribute that the rest of the browser already understands (visibleTabs,
// keyboard navigation, "Close other tabs" and so on). gBrowser.hideTab()
// refuses pinned tabs, so hiding is done here directly.
//
// Pods are stored per window with SessionStore (window value WIN_KEY), the pod
// of a tab is stored as tab value TAB_KEY and mirrored to the "tabpods"
// attribute, which is what the rest of the script reads.

(function () {
  "use strict";

  const TAB_KEY = "tabpods-pod";
  const WIN_KEY = "tabpods-pods";

  const COLORS = [
    ["orange", "#ff9548"],
    ["blue", "#3cb7f2"],
    ["green", "#4ccf6c"],
    ["yellow", "#f4c542"],
    ["red", "#f2555a"],
    ["pink", "#f26fb4"],
    ["purple", "#a67ff2"],
    ["cyan", "#2fd0c4"],
    ["gray", "#9ba1a6"],
  ];
  const COLOR_IDS = COLORS.map(c => c[0]);

  // ---------------------------------------------------------------------------
  // Localization
  //
  // The UI follows the language of Firefox; the string pref
  // extensions.tabpods.locale (for example "en" or "de") overrides it.
  // A string with a count has a form per Intl.PluralRules category, "other"
  // being the fallback. Unnamed pods are called by their color.

  const STRINGS = {
    en: {
      menu: "Pod",
      newPod: "New pod",
      newPodFrom: {one: "New pod from {n} tab", other: "New pod from {n} tabs"},
      addTo: "Add to “{name}” ({n})",
      removeFromPod: "Remove from pod",
      collapse: "Collapse",
      expand: "Expand",
      rename: "Rename…",
      renamePrompt: "Pod name:",
      color: "Color",
      collapseAll: "Collapse all pods",
      expandAll: "Expand all pods",
      ungroup: "Ungroup pod",
      closeTabs: {one: "Close {n} tab", other: "Close {n} tabs"},
      tooltip: {one: "{name}: {n} tab", other: "{name}: {n} tabs"},
      hintCollapsed: "collapsed, click to expand",
      hintExpanded: "click to collapse",
      colors: {orange: "Orange", blue: "Blue", green: "Green", yellow: "Yellow", red: "Red", pink: "Pink", purple: "Purple", cyan: "Cyan", gray: "Gray"},
    },
    ru: {
      menu: "Капсула",
      newPod: "Новая капсула",
      newPodFrom: {one: "Новая капсула из {n} вкладки", few: "Новая капсула из {n} вкладок", many: "Новая капсула из {n} вкладок", other: "Новая капсула из {n} вкладки"},
      addTo: "Добавить в «{name}» ({n})",
      removeFromPod: "Убрать из капсулы",
      collapse: "Свернуть",
      expand: "Развернуть",
      rename: "Переименовать…",
      renamePrompt: "Название капсулы:",
      color: "Цвет",
      collapseAll: "Свернуть все капсулы",
      expandAll: "Развернуть все капсулы",
      ungroup: "Расформировать капсулу",
      closeTabs: {one: "Закрыть {n} вкладку", few: "Закрыть {n} вкладки", many: "Закрыть {n} вкладок", other: "Закрыть {n} вкладки"},
      tooltip: {one: "{name}: {n} вкладка", few: "{name}: {n} вкладки", many: "{name}: {n} вкладок", other: "{name}: {n} вкладки"},
      hintCollapsed: "свёрнута, клик — развернуть",
      hintExpanded: "клик — свернуть",
      colors: {orange: "Оранжевый", blue: "Голубой", green: "Зелёный", yellow: "Жёлтый", red: "Красный", pink: "Розовый", purple: "Фиолетовый", cyan: "Бирюзовый", gray: "Серый"},
    },
    uk: {
      menu: "Капсула",
      newPod: "Нова капсула",
      newPodFrom: {one: "Нова капсула з {n} вкладки", few: "Нова капсула з {n} вкладок", many: "Нова капсула з {n} вкладок", other: "Нова капсула з {n} вкладки"},
      addTo: "Додати до «{name}» ({n})",
      removeFromPod: "Вилучити з капсули",
      collapse: "Згорнути",
      expand: "Розгорнути",
      rename: "Перейменувати…",
      renamePrompt: "Назва капсули:",
      color: "Колір",
      collapseAll: "Згорнути всі капсули",
      expandAll: "Розгорнути всі капсули",
      ungroup: "Розформувати капсулу",
      closeTabs: {one: "Закрити {n} вкладку", few: "Закрити {n} вкладки", many: "Закрити {n} вкладок", other: "Закрити {n} вкладки"},
      tooltip: {one: "{name}: {n} вкладка", few: "{name}: {n} вкладки", many: "{name}: {n} вкладок", other: "{name}: {n} вкладки"},
      hintCollapsed: "згорнута, клацніть, щоб розгорнути",
      hintExpanded: "клацніть, щоб згорнути",
      colors: {orange: "Помаранчевий", blue: "Блакитний", green: "Зелений", yellow: "Жовтий", red: "Червоний", pink: "Рожевий", purple: "Фіолетовий", cyan: "Бірюзовий", gray: "Сірий"},
    },
    de: {
      menu: "Kapsel",
      newPod: "Neue Kapsel",
      newPodFrom: {one: "Neue Kapsel aus {n} Tab", other: "Neue Kapsel aus {n} Tabs"},
      addTo: "Zu „{name}“ hinzufügen ({n})",
      removeFromPod: "Aus Kapsel entfernen",
      collapse: "Einklappen",
      expand: "Ausklappen",
      rename: "Umbenennen…",
      renamePrompt: "Name der Kapsel:",
      color: "Farbe",
      collapseAll: "Alle Kapseln einklappen",
      expandAll: "Alle Kapseln ausklappen",
      ungroup: "Kapsel auflösen",
      closeTabs: {one: "{n} Tab schließen", other: "{n} Tabs schließen"},
      tooltip: {one: "{name}: {n} Tab", other: "{name}: {n} Tabs"},
      hintCollapsed: "eingeklappt, zum Ausklappen klicken",
      hintExpanded: "zum Einklappen klicken",
      colors: {orange: "Orange", blue: "Blau", green: "Grün", yellow: "Gelb", red: "Rot", pink: "Pink", purple: "Lila", cyan: "Türkis", gray: "Grau"},
    },
    fr: {
      menu: "Capsule",
      newPod: "Nouvelle capsule",
      newPodFrom: {one: "Nouvelle capsule avec {n} onglet", other: "Nouvelle capsule avec {n} onglets"},
      addTo: "Ajouter à « {name} » ({n})",
      removeFromPod: "Retirer de la capsule",
      collapse: "Réduire",
      expand: "Développer",
      rename: "Renommer…",
      renamePrompt: "Nom de la capsule :",
      color: "Couleur",
      collapseAll: "Réduire toutes les capsules",
      expandAll: "Développer toutes les capsules",
      ungroup: "Dissoudre la capsule",
      closeTabs: {one: "Fermer {n} onglet", other: "Fermer {n} onglets"},
      tooltip: {one: "{name} : {n} onglet", other: "{name} : {n} onglets"},
      hintCollapsed: "réduite, cliquer pour développer",
      hintExpanded: "cliquer pour réduire",
      colors: {orange: "Orange", blue: "Bleu", green: "Vert", yellow: "Jaune", red: "Rouge", pink: "Rose", purple: "Violet", cyan: "Turquoise", gray: "Gris"},
    },
    es: {
      menu: "Cápsula",
      newPod: "Nueva cápsula",
      newPodFrom: {one: "Nueva cápsula con {n} pestaña", other: "Nueva cápsula con {n} pestañas"},
      addTo: "Añadir a «{name}» ({n})",
      removeFromPod: "Quitar de la cápsula",
      collapse: "Contraer",
      expand: "Expandir",
      rename: "Renombrar…",
      renamePrompt: "Nombre de la cápsula:",
      color: "Color",
      collapseAll: "Contraer todas las cápsulas",
      expandAll: "Expandir todas las cápsulas",
      ungroup: "Desagrupar cápsula",
      closeTabs: {one: "Cerrar {n} pestaña", other: "Cerrar {n} pestañas"},
      tooltip: {one: "{name}: {n} pestaña", other: "{name}: {n} pestañas"},
      hintCollapsed: "contraída, haz clic para expandir",
      hintExpanded: "haz clic para contraer",
      colors: {orange: "Naranja", blue: "Azul", green: "Verde", yellow: "Amarillo", red: "Rojo", pink: "Rosa", purple: "Morado", cyan: "Turquesa", gray: "Gris"},
    },
    it: {
      menu: "Capsula",
      newPod: "Nuova capsula",
      newPodFrom: {one: "Nuova capsula con {n} scheda", other: "Nuova capsula con {n} schede"},
      addTo: "Aggiungi a «{name}» ({n})",
      removeFromPod: "Rimuovi dalla capsula",
      collapse: "Comprimi",
      expand: "Espandi",
      rename: "Rinomina…",
      renamePrompt: "Nome della capsula:",
      color: "Colore",
      collapseAll: "Comprimi tutte le capsule",
      expandAll: "Espandi tutte le capsule",
      ungroup: "Sciogli capsula",
      closeTabs: {one: "Chiudi {n} scheda", other: "Chiudi {n} schede"},
      tooltip: {one: "{name}: {n} scheda", other: "{name}: {n} schede"},
      hintCollapsed: "compressa, fai clic per espandere",
      hintExpanded: "fai clic per comprimere",
      colors: {orange: "Arancione", blue: "Blu", green: "Verde", yellow: "Giallo", red: "Rosso", pink: "Rosa", purple: "Viola", cyan: "Turchese", gray: "Grigio"},
    },
    "pt-BR": {
      menu: "Cápsula",
      newPod: "Nova cápsula",
      newPodFrom: {one: "Nova cápsula com {n} aba", other: "Nova cápsula com {n} abas"},
      addTo: "Adicionar a “{name}” ({n})",
      removeFromPod: "Remover da cápsula",
      collapse: "Recolher",
      expand: "Expandir",
      rename: "Renomear…",
      renamePrompt: "Nome da cápsula:",
      color: "Cor",
      collapseAll: "Recolher todas as cápsulas",
      expandAll: "Expandir todas as cápsulas",
      ungroup: "Desagrupar cápsula",
      closeTabs: {one: "Fechar {n} aba", other: "Fechar {n} abas"},
      tooltip: {one: "{name}: {n} aba", other: "{name}: {n} abas"},
      hintCollapsed: "recolhida, clique para expandir",
      hintExpanded: "clique para recolher",
      colors: {orange: "Laranja", blue: "Azul", green: "Verde", yellow: "Amarelo", red: "Vermelho", pink: "Rosa", purple: "Roxo", cyan: "Ciano", gray: "Cinza"},
    },
    pl: {
      menu: "Kapsuła",
      newPod: "Nowa kapsuła",
      newPodFrom: {one: "Nowa kapsuła z {n} karty", few: "Nowa kapsuła z {n} kart", many: "Nowa kapsuła z {n} kart", other: "Nowa kapsuła z {n} karty"},
      addTo: "Dodaj do „{name}” ({n})",
      removeFromPod: "Usuń z kapsuły",
      collapse: "Zwiń",
      expand: "Rozwiń",
      rename: "Zmień nazwę…",
      renamePrompt: "Nazwa kapsuły:",
      color: "Kolor",
      collapseAll: "Zwiń wszystkie kapsuły",
      expandAll: "Rozwiń wszystkie kapsuły",
      ungroup: "Rozgrupuj kapsułę",
      closeTabs: {one: "Zamknij {n} kartę", few: "Zamknij {n} karty", many: "Zamknij {n} kart", other: "Zamknij {n} karty"},
      tooltip: {one: "{name}: {n} karta", few: "{name}: {n} karty", many: "{name}: {n} kart", other: "{name}: {n} karty"},
      hintCollapsed: "zwinięta, kliknij, aby rozwinąć",
      hintExpanded: "kliknij, aby zwinąć",
      colors: {orange: "Pomarańczowy", blue: "Niebieski", green: "Zielony", yellow: "Żółty", red: "Czerwony", pink: "Różowy", purple: "Fioletowy", cyan: "Turkusowy", gray: "Szary"},
    },
    ja: {
      menu: "カプセル",
      newPod: "新しいカプセル",
      newPodFrom: {other: "{n} 個のタブで新しいカプセル"},
      addTo: "「{name}」に追加 ({n})",
      removeFromPod: "カプセルから外す",
      collapse: "折りたたむ",
      expand: "展開する",
      rename: "名前を変更…",
      renamePrompt: "カプセルの名前:",
      color: "色",
      collapseAll: "すべてのカプセルを折りたたむ",
      expandAll: "すべてのカプセルを展開する",
      ungroup: "カプセルを解除",
      closeTabs: {other: "{n} 個のタブを閉じる"},
      tooltip: {other: "{name}: {n} 個のタブ"},
      hintCollapsed: "折りたたみ中、クリックで展開",
      hintExpanded: "クリックで折りたたむ",
      colors: {orange: "オレンジ", blue: "青", green: "緑", yellow: "黄", red: "赤", pink: "ピンク", purple: "紫", cyan: "シアン", gray: "グレー"},
    },
    "zh-CN": {
      menu: "胶囊",
      newPod: "新建胶囊",
      newPodFrom: {other: "用 {n} 个标签页新建胶囊"},
      addTo: "添加到“{name}”({n})",
      removeFromPod: "从胶囊中移除",
      collapse: "折叠",
      expand: "展开",
      rename: "重命名…",
      renamePrompt: "胶囊名称：",
      color: "颜色",
      collapseAll: "折叠所有胶囊",
      expandAll: "展开所有胶囊",
      ungroup: "解散胶囊",
      closeTabs: {other: "关闭 {n} 个标签页"},
      tooltip: {other: "{name}：{n} 个标签页"},
      hintCollapsed: "已折叠，点击展开",
      hintExpanded: "点击折叠",
      colors: {orange: "橙色", blue: "蓝色", green: "绿色", yellow: "黄色", red: "红色", pink: "粉色", purple: "紫色", cyan: "青色", gray: "灰色"},
    },
    "zh-TW": {
      menu: "膠囊",
      newPod: "新增膠囊",
      newPodFrom: {other: "以 {n} 個分頁新增膠囊"},
      addTo: "加入「{name}」({n})",
      removeFromPod: "從膠囊移除",
      collapse: "摺疊",
      expand: "展開",
      rename: "重新命名…",
      renamePrompt: "膠囊名稱：",
      color: "顏色",
      collapseAll: "摺疊所有膠囊",
      expandAll: "展開所有膠囊",
      ungroup: "解散膠囊",
      closeTabs: {other: "關閉 {n} 個分頁"},
      tooltip: {other: "{name}：{n} 個分頁"},
      hintCollapsed: "已摺疊，點擊展開",
      hintExpanded: "點擊摺疊",
      colors: {orange: "橘色", blue: "藍色", green: "綠色", yellow: "黃色", red: "紅色", pink: "粉紅色", purple: "紫色", cyan: "青色", gray: "灰色"},
    },
  };

  function pickLocale() {
    const wanted = [Services.prefs.getStringPref("extensions.tabpods.locale", ""), ...Services.locale.appLocalesAsBCP47];
    for (const tag of wanted.filter(Boolean)) {
      if (STRINGS[tag]) {
        return tag;
      }
      const [lang] = tag.split("-");
      if (lang == "zh") {
        return /-(TW|HK|MO|Hant)\b/i.test(tag) ? "zh-TW" : "zh-CN";
      }
      if (lang == "pt") {
        return "pt-BR";
      }
      if (STRINGS[lang]) {
        return lang;
      }
    }
    return "en";
  }

  const LOCALE = pickLocale();
  const PLURALS = new Intl.PluralRules(LOCALE);

  // Returns the string for key with {placeholders} filled in from vars.
  function t(key, vars = {}) {
    let text = STRINGS[LOCALE][key] ?? STRINGS.en[key];
    if (typeof text == "object") {
      text = text[PLURALS.select(vars.n)] ?? text.other;
    }
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
  }

  const colorName = id => (STRINGS[LOCALE].colors ?? STRINGS.en.colors)[id] ?? id;

  const CSS = `
    ${COLORS.map(([id, hex]) => `[tabpods-color="${id}"] { --tabpods-color: ${hex}; }`).join("\n")}

    .tabpods-capsule {
      -moz-window-dragging: no-drag;
      align-items: center;
      justify-content: center;
      padding-inline: 3px;
      cursor: pointer;
    }
    .tabpods-pill {
      width: 7px;
      height: 26px;
      border-radius: 3.5px;
      background-color: var(--tabpods-color);
      transition: opacity 120ms, filter 120ms;
    }
    .tabpods-capsule:not([tabpods-collapsed]) > .tabpods-pill {
      opacity: 0.55;
    }
    .tabpods-capsule:hover > .tabpods-pill {
      opacity: 1;
      filter: brightness(1.15);
    }

    .tabbrowser-tab[tabpods-color] {
      background-image: linear-gradient(var(--tabpods-color), var(--tabpods-color));
      background-size: calc(100% - 14px) 2px;
      background-position: center bottom 2px;
      background-repeat: no-repeat;
    }
  `;

  /** gBrowser.tabContainer, set in init(): the script runs before gBrowser exists. */
  let tabs;

  /** @type {Map<string, {id: string, color: string, name: string, collapsed: boolean}>} */
  const pods = new Map();
  /** Pods whose last tab was closed, kept so "Reopen closed tab" can bring them back. */
  const removedPods = new Map();
  /** @type {Map<string, Element>} */
  const capsules = new Map();

  let busy = 0; // > 0 while TabPods moves tabs itself
  let restoring = false; // the window is being restored by SessionStore
  const movedTabs = new Set();
  const pinToggledTabs = new Set();
  const openedTabs = new WeakSet(); // new tabs, not yet handled by onTabOpen
  let stripObserver = null;
  let updateTimer = 0;

  // ---------------------------------------------------------------------------
  // Helpers

  const colorHex = id => (COLORS.find(c => c[0] == id) || COLORS[0])[1];

  const podOf = tab => pods.get(tab.getAttribute("tabpods")) || null;
  const capsulePod = el => (el?.classList.contains("tabpods-capsule") && pods.get(el.getAttribute("pod"))) || null;
  const liveTabs = () => gBrowser.tabs.filter(t => !t.closing);
  const membersOf = pod => liveTabs().filter(t => t.getAttribute("tabpods") == pod.id);
  // Tabs inside native tab groups or split views are left alone.
  const eligible = tab => !tab.closing && !tab.group && !tab.splitview && tab != FirefoxViewHandler.tab;

  function podLabel(pod) {
    return pod.name || colorName(pod.color);
  }

  function withBusy(fn) {
    busy++;
    try {
      return fn();
    } finally {
      busy--;
      // Our own moves are not user moves.
      stripObserver?.takeRecords();
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence

  function saveState() {
    try {
      SessionStore.setCustomWindowValue(window, WIN_KEY, JSON.stringify([...pods.values()]));
    } catch (e) {
      console.error("TabPods: cannot save pods", e);
    }
  }

  function loadState() {
    let data = [];
    try {
      data = JSON.parse(SessionStore.getCustomWindowValue(window, WIN_KEY) || "[]");
    } catch (e) {
      console.error("TabPods: cannot read pods", e);
    }
    if (!Array.isArray(data) || !data.length) {
      // Nothing stored yet (or the window has not been restored yet): keep what we have.
      return;
    }
    pods.clear();
    for (const p of data) {
      if (p && typeof p.id == "string") {
        pods.set(p.id, {
          id: p.id,
          color: COLOR_IDS.includes(p.color) ? p.color : COLOR_IDS[0],
          name: typeof p.name == "string" ? p.name : "",
          collapsed: !!p.collapsed,
        });
      }
    }
  }

  // Syncs the tabpods attribute of a tab with its SessionStore value.
  function readTab(tab) {
    const id = SessionStore.getCustomTabValue(tab, TAB_KEY);
    if (id && !pods.has(id) && removedPods.has(id)) {
      pods.set(id, removedPods.get(id));
      removedPods.delete(id);
      saveState();
    }
    const pod = id && pods.get(id);
    if (pod && eligible(tab)) {
      markTab(tab, pod);
    } else {
      unmarkTab(tab);
    }
  }

  function markTab(tab, pod) {
    tab.setAttribute("tabpods", pod.id);
    tab.setAttribute("tabpods-color", pod.color);
  }

  function unmarkTab(tab) {
    tab.removeAttribute("tabpods");
    tab.removeAttribute("tabpods-color");
  }

  function assign(tab, pod) {
    markTab(tab, pod);
    SessionStore.setCustomTabValue(tab, TAB_KEY, pod.id);
  }

  function unassign(tab) {
    unmarkTab(tab);
    SessionStore.deleteCustomTabValue(tab, TAB_KEY);
    if (tab.hidden) {
      gBrowser.showTab(tab);
    }
  }

  // ---------------------------------------------------------------------------
  // Hiding and showing

  function hideTab(tab) {
    if (tab.hidden || tab.selected || tab.closing) {
      return;
    }
    if (tab.multiselected) {
      gBrowser.removeFromMultiSelectedTabs(tab);
    }
    tab.setAttribute("hidden", "true");
    tabs._invalidateCachedVisibleTabs();
    gBrowser.replaceInSuccession(tab, tab.successor);
    gBrowser.setSuccessor(tab, null);
    tab.dispatchEvent(new CustomEvent("TabHide", {bubbles: true}));
  }

  function collapse(pod) {
    const members = membersOf(pod);
    if (!members.length) {
      return;
    }
    if (members.includes(gBrowser.selectedTab)) {
      const next = gBrowser._findTabToBlurTo(gBrowser.selectedTab, [...members]);
      if (!next) {
        return; // the pod holds every tab of the window
      }
      gBrowser.selectedTab = next;
    }
    pod.collapsed = true;
    members.forEach(hideTab);
    tabs._updateCloseButtons();
    updateCapsule(pod);
    saveState();
  }

  function expand(pod) {
    pod.collapsed = false;
    for (const tab of membersOf(pod)) {
      gBrowser.showTab(tab);
    }
    updateCapsule(pod);
    saveState();
  }

  function toggle(pod) {
    if (pod.collapsed) {
      expand(pod);
    } else {
      collapse(pod);
    }
  }

  // Brings the visibility of the tabs in line with the pod state, after a
  // session restore (SessionStore cannot hide pinned tabs).
  function applyCollapsed() {
    for (const pod of pods.values()) {
      if (!pod.collapsed) {
        continue;
      }
      const members = membersOf(pod);
      if (members.includes(gBrowser.selectedTab)) {
        expand(pod);
      } else if (members.some(t => !t.hidden)) {
        members.forEach(hideTab);
        tabs._updateCloseButtons();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tab strip

  // Every child of the tab containers is taken for a tab, so keep the capsules
  // out of allTabs (and with it gBrowser.tabs, visibleTabs, ...).
  function patchAllTabs() {
    let proto = Object.getPrototypeOf(tabs);
    while (proto && !Object.getOwnPropertyDescriptor(proto, "allTabs")) {
      proto = Object.getPrototypeOf(proto);
    }
    const getAllTabs = Object.getOwnPropertyDescriptor(proto, "allTabs").get;
    let source = null, filtered = null;
    Object.defineProperty(tabs, "allTabs", {
      configurable: true,
      get() {
        const all = getAllTabs.call(this);
        if (all !== source) {
          source = all;
          filtered = all.filter(el => !el.classList.contains("tabpods-capsule"));
        }
        return filtered;
      },
    });
  }

  function createCapsule(pod) {
    const capsule = document.createXULElement("hbox");
    capsule.className = "tabpods-capsule";
    capsule.setAttribute("pod", pod.id);
    capsule.setAttribute("context", "tabpods-capsule-menu");
    const pill = document.createXULElement("box");
    pill.className = "tabpods-pill";
    capsule.append(pill);
    return capsule;
  }

  // Mouse events on capsules are handled in the capture phase of the window:
  // the tab strip and Tab Mix Plus listen in the capture phase too and would
  // take them for clicks on the empty tab bar (a double click opens a new
  // tab, a middle click duplicates one and so on).
  function onCapsuleMouse(e) {
    const capsule = e.target.closest?.(".tabpods-capsule");
    if (!capsule) {
      return;
    }
    e.stopPropagation();
    if (e.type == "click" && e.button == 0) {
      const pod = pods.get(capsule.getAttribute("pod"));
      if (pod) toggle(pod);
    }
  }

  function updateCapsule(pod) {
    const count = membersOf(pod).length;
    for (const capsule of capsules.values()) {
      if (capsule.getAttribute("pod") != pod.id) {
        continue;
      }
      capsule.setAttribute("tabpods-color", pod.color);
      capsule.toggleAttribute("tabpods-collapsed", pod.collapsed);
      capsule.setAttribute(
        "tooltiptext",
        `${t("tooltip", {name: podLabel(pod), n: count})} (${t(pod.collapsed ? "hintCollapsed" : "hintExpanded")})`
      );
    }
  }

  // Puts a capsule right before every run of tabs of a pod. A pod normally is
  // a single run, but its pinned tabs may sit apart from the others when
  // another pod already occupies the border between pinned and unpinned tabs.
  function placeCapsules() {
    const wanted = new Map(); // "podId#run" -> first tab of the run
    const runCount = new Map();
    let previous = null;
    for (const tab of liveTabs()) {
      const pod = podOf(tab);
      if (pod && pod !== previous) {
        const n = runCount.get(pod.id) || 0;
        runCount.set(pod.id, n + 1);
        wanted.set(`${pod.id}#${n}`, tab);
      }
      previous = pod;
    }
    for (const [key, capsule] of capsules) {
      if (!wanted.has(key)) {
        capsule.remove();
        capsules.delete(key);
      }
    }
    for (const [key, tab] of wanted) {
      let capsule = capsules.get(key);
      if (!capsule) {
        capsule = createCapsule(podOf(tab));
        capsules.set(key, capsule);
      }
      if (tab.previousElementSibling !== capsule) {
        tab.before(capsule);
      }
    }
    for (const pod of pods.values()) {
      updateCapsule(pod);
    }
  }

  function update() {
    clearTimeout(updateTimer);
    updateTimer = 0;
    if (!restoring) {
      processMoves();
    }
    for (const tab of liveTabs()) {
      if (tab.hasAttribute("tabpods") && (!podOf(tab) || !eligible(tab))) {
        unmarkTab(tab);
      }
    }
    placeCapsules();
  }

  function scheduleUpdate() {
    if (!updateTimer) {
      updateTimer = setTimeout(update, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Keeping pods together

  // The pod (other than the given one) whose tabs sit on both sides of the
  // border between pinned and unpinned tabs.
  function borderPod(pod) {
    const all = liveTabs().filter(t => t.getAttribute("tabpods") != pod.id);
    const i = all.findIndex(t => !t.pinned);
    if (i < 1) {
      return null;
    }
    const other = podOf(all[i - 1]);
    return other && other === podOf(all[i]) ? other : null;
  }

  // Moves tabs right after each other, in the given order.
  function chain(order) {
    for (let i = 1; i < order.length; i++) {
      if (order[i].previousElementSibling !== order[i - 1]) {
        gBrowser.moveTabAfter(order[i], order[i - 1]);
      }
    }
  }

  // Moves the tabs of a pod next to each other, in the given order. A pod with
  // both pinned and unpinned tabs goes across the border between the two: its
  // pinned tabs last among the pinned ones, the others first after them. If
  // another pod is there already, the pinned tabs go right before that pod.
  function gather(pod, order) {
    const pinned = order.filter(t => t.pinned);
    const unpinned = order.filter(t => !t.pinned);
    withBusy(() => {
      if (!pinned.length || !unpinned.length) {
        chain(order);
        return;
      }
      const other = borderPod(pod);
      if (other) {
        const anchor = membersOf(other).find(t => t.pinned);
        for (const tab of pinned) {
          gBrowser.moveTabBefore(tab, anchor);
        }
        chain(unpinned);
        return;
      }
      for (const tab of pinned) {
        gBrowser.moveTabTo(tab, {tabIndex: gBrowser.pinnedTabCount - 1});
      }
      for (const tab of unpinned.reverse()) {
        gBrowser.moveTabTo(tab, {tabIndex: gBrowser.pinnedTabCount});
      }
    });
  }

  // Pinning moves a tab to the end of the pinned tabs and unpinning to the
  // start of the unpinned ones; put it back next to the rest of its pod.
  function placePinToggled(tab) {
    const pod = podOf(tab);
    if (!pod) {
      return;
    }
    const others = membersOf(pod).filter(t => t != tab);
    const other = borderPod(pod);
    withBusy(() => {
      if (tab.pinned) {
        const pinned = others.filter(t => t.pinned);
        if (pinned.length) {
          gBrowser.moveTabAfter(tab, pinned.at(-1));
        } else if (other) {
          gBrowser.moveTabBefore(tab, membersOf(other).find(t => t.pinned));
        } else {
          // The pod goes across the border now, the rest of it follows the tab.
          for (const t of others.reverse()) {
            gBrowser.moveTabTo(t, {tabIndex: gBrowser.pinnedTabCount});
          }
        }
      } else {
        const unpinned = others.filter(t => !t.pinned);
        if (unpinned.length) {
          gBrowser.moveTabBefore(tab, unpinned[0]);
        } else if (other) {
          gBrowser.moveTabAfter(tab, membersOf(other).at(-1));
        }
      }
    });
  }

  // Runs of tabs that sit next to each other in the strip.
  function runsOf(pod) {
    const runs = [];
    let run = null;
    for (const tab of liveTabs()) {
      if (tab.getAttribute("tabpods") == pod.id) {
        if (!run) runs.push((run = []));
        run.push(tab);
      } else {
        run = null;
      }
    }
    return runs;
  }

  // Applies the drag and drop rules to tabs moved by the user (or by other
  // code): a tab dragged away from its pod leaves it, tabs dropped between
  // two tabs of a pod join it.
  function processMoves() {
    if (!movedTabs.size && !pinToggledTabs.size) {
      return;
    }
    const moved = new Set([...movedTabs].filter(t => !t.closing && t.isConnected));
    const toggled = [...pinToggledTabs].filter(t => !t.closing && t.isConnected);
    movedTabs.clear();
    pinToggledTabs.clear();
    let changed = false;

    for (const tab of toggled) {
      placePinToggled(tab);
      moved.delete(tab);
    }

    // Dropping a tab moves it before the tab under the pointer, or after it;
    // capsules are not tabs, so a tab dropped onto the left half of the first
    // tab of a pod lands between the capsule and that tab, and one dropped
    // onto the tab before the pod lands before the capsule. Capsules are put
    // back in place only after this, so their position tells which side of
    // the capsule the tab was dropped on.

    // A tab of the pod dropped right before the pod's capsule was dragged out.
    for (const tab of moved) {
      const pod = podOf(tab);
      if (
        pod &&
        capsulePod(tab.nextElementSibling) === pod &&
        membersOf(pod).some(t => !moved.has(t))
      ) {
        unassign(tab);
        changed = true;
      }
    }

    // Moved tabs that ended up apart from every tab of their pod that stayed
    // in place have left the pod.
    for (const pod of new Set([...moved].map(podOf).filter(Boolean))) {
      const runs = runsOf(pod);
      const movedOnly = runs.filter(run => run.every(t => moved.has(t)));
      if (movedOnly.length && movedOnly.length < runs.length) {
        movedOnly.flat().forEach(unassign);
        changed = true;
      }
    }

    const all = liveTabs();
    for (let i = 0; i < all.length; i++) {
      if (!moved.has(all[i]) || podOf(all[i])) {
        continue;
      }
      let j = i;
      while (j + 1 < all.length && moved.has(all[j + 1]) && !podOf(all[j + 1])) j++;
      // Tabs dropped right after a capsule or between two tabs of a pod join it.
      const before = all[i - 1] && podOf(all[i - 1]);
      const after = all[j + 1] && podOf(all[j + 1]);
      const target = capsulePod(all[i].previousElementSibling) || (before === after && before);
      if (target) {
        all.slice(i, j + 1).forEach(t => assign(t, target));
        changed = true;
      }
      i = j;
    }

    if (changed) {
      dropEmptyPods();
    }
  }

  function dropEmptyPods() {
    let changed = false;
    for (const pod of [...pods.values()]) {
      if (!membersOf(pod).length) {
        pods.delete(pod.id);
        removedPods.set(pod.id, pod);
        changed = true;
      }
    }
    if (changed) {
      saveState();
    }
  }

  // ---------------------------------------------------------------------------
  // Actions

  function newPodId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function nextColor() {
    const used = new Set([...pods.values()].map(p => p.color));
    return COLOR_IDS.find(c => !used.has(c)) || COLOR_IDS[pods.size % COLOR_IDS.length];
  }

  function createPod(tabList) {
    tabList = tabList.filter(eligible);
    if (!tabList.length) {
      return null;
    }
    const pod = {id: newPodId(), color: nextColor(), name: "", collapsed: false};
    pods.set(pod.id, pod);
    for (const tab of tabList) {
      assign(tab, pod);
    }
    gather(pod, tabList);
    dropEmptyPods();
    saveState();
    update();
    return pod;
  }

  function addToPod(tabList, pod) {
    tabList = tabList.filter(t => eligible(t) && podOf(t) !== pod);
    if (!tabList.length) {
      return;
    }
    if (pod.collapsed) {
      expand(pod);
    }
    const order = [...membersOf(pod), ...tabList];
    for (const tab of tabList) {
      assign(tab, pod);
    }
    gather(pod, order);
    dropEmptyPods();
    saveState();
    update();
  }

  function removeFromPods(tabList) {
    for (const tab of tabList) {
      const pod = podOf(tab);
      if (!pod) {
        continue;
      }
      unassign(tab);
      // Take the tab out of the middle of its pod.
      const members = membersOf(pod);
      const all = liveTabs();
      const index = all.indexOf(tab);
      if (members.length && index > all.indexOf(members[0]) && index < all.indexOf(members.at(-1))) {
        withBusy(() => {
          if (tab.pinned) {
            gBrowser.moveTabBefore(tab, members.find(t => t.pinned));
          } else {
            gBrowser.moveTabAfter(tab, members.at(-1));
          }
        });
      }
    }
    dropEmptyPods();
    saveState();
    update();
  }

  function ungroupPod(pod) {
    for (const tab of membersOf(pod)) {
      unassign(tab);
    }
    pods.delete(pod.id);
    saveState();
    update();
  }

  function closePodTabs(pod) {
    gBrowser.removeTabs(membersOf(pod));
  }

  function renamePod(pod) {
    const value = {value: pod.name};
    if (Services.prompt.prompt(window, "TabPods", t("renamePrompt"), value, null, {value: false})) {
      pod.name = value.value.trim();
      updateCapsule(pod);
      saveState();
    }
  }

  function setColor(pod, color) {
    pod.color = color;
    for (const tab of membersOf(pod)) {
      tab.setAttribute("tabpods-color", color);
    }
    updateCapsule(pod);
    saveState();
  }

  // ---------------------------------------------------------------------------
  // Menus

  function colorIcon(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="4" y="1" width="8" height="14" rx="4" fill="${colorHex(color)}"/></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function menuItem(label, command, attrs = {}) {
    const item = document.createXULElement("menuitem");
    item.setAttribute("label", label);
    for (const [name, value] of Object.entries(attrs)) {
      // Since Firefox 149 boolean XUL attributes count by presence, so
      // disabled="false" would disable the item too.
      if (typeof value == "boolean") {
        item.toggleAttribute(name, value);
      } else {
        item.setAttribute(name, value);
      }
    }
    item.addEventListener("command", command);
    return item;
  }

  // Pods in the order of the tab strip.
  function orderedPods() {
    const seen = new Set();
    for (const tab of liveTabs()) {
      const pod = podOf(tab);
      if (pod) seen.add(pod);
    }
    return [...seen];
  }

  function contextTabs() {
    const tab = TabContextMenu.contextTab;
    if (!tab) return [];
    return tab.multiselected ? gBrowser.selectedTabs : [tab];
  }

  function buildTabContextMenu() {
    const tabMenu = document.getElementById("tabContextMenu");
    const menu = document.createXULElement("menu");
    menu.id = "tabpods-tab-menu";
    menu.setAttribute("label", t("menu"));
    const popup = document.createXULElement("menupopup");
    menu.append(popup);
    tabMenu.insertBefore(menu, document.getElementById("context_openAndOrganizeSeparator"));

    tabMenu.addEventListener("popupshowing", e => {
      if (e.target == tabMenu) {
        menu.hidden = !contextTabs().some(eligible);
      }
    });

    popup.addEventListener("popupshowing", e => {
      if (e.target != popup) return;
      popup.replaceChildren();
      const target = contextTabs().filter(eligible);
      const n = target.length;
      popup.append(menuItem(n > 1 ? t("newPodFrom", {n}) : t("newPod"), () => createPod(target)));
      const list = orderedPods();
      if (list.length) {
        popup.append(document.createXULElement("menuseparator"));
        for (const pod of list) {
          const count = membersOf(pod).length;
          popup.append(
            menuItem(t("addTo", {name: podLabel(pod), n: count}), () => addToPod(target, pod), {
              class: "menuitem-iconic",
              image: colorIcon(pod.color),
              disabled: target.every(t => podOf(t) === pod),
            })
          );
        }
      }
      if (target.some(podOf)) {
        popup.append(document.createXULElement("menuseparator"));
        popup.append(menuItem(t("removeFromPod"), () => removeFromPods(target)));
      }
    });
  }

  function buildCapsuleMenu() {
    const popup = document.createXULElement("menupopup");
    popup.id = "tabpods-capsule-menu";
    document.getElementById("mainPopupSet").append(popup);

    const podFromMenu = () => pods.get(popup.triggerNode?.closest(".tabpods-capsule")?.getAttribute("pod"));

    popup.addEventListener("popupshowing", e => {
      if (e.target != popup) return;
      const pod = podFromMenu();
      if (!pod) {
        e.preventDefault();
        return;
      }
      popup.replaceChildren();
      popup.append(menuItem(t(pod.collapsed ? "expand" : "collapse"), () => toggle(pod)));
      popup.append(menuItem(t("rename"), () => renamePod(pod)));

      const colorMenu = document.createXULElement("menu");
      colorMenu.setAttribute("label", t("color"));
      const colorPopup = document.createXULElement("menupopup");
      for (const id of COLOR_IDS) {
        colorPopup.append(
          menuItem(colorName(id), () => setColor(pod, id), {
            class: "menuitem-iconic",
            image: colorIcon(id),
            disabled: id == pod.color,
          })
        );
      }
      colorMenu.append(colorPopup);
      popup.append(colorMenu);

      popup.append(document.createXULElement("menuseparator"));
      popup.append(menuItem(t("collapseAll"), () => orderedPods().forEach(p => !p.collapsed && collapse(p))));
      popup.append(menuItem(t("expandAll"), () => orderedPods().forEach(p => p.collapsed && expand(p))));
      popup.append(document.createXULElement("menuseparator"));
      popup.append(menuItem(t("ungroup"), () => ungroupPod(pod)));
      const count = membersOf(pod).length;
      popup.append(menuItem(t("closeTabs", {n: count}), () => closePodTabs(pod)));
    });
  }

  // ---------------------------------------------------------------------------
  // Events

  function onTabSelect() {
    const pod = podOf(gBrowser.selectedTab);
    if (pod?.collapsed) {
      expand(pod);
    }
  }

  function onTabOpen(e) {
    if (restoring) return;
    const tab = e.target;
    openedTabs.add(tab);
    // Wait for SessionStore: a reopened closed tab gets its pod back.
    setTimeout(() => {
      openedTabs.delete(tab);
      if (!tab.isConnected || tab.closing) return;
      readTab(tab);
      if (!podOf(tab)) {
        // New tabs do not join a pod, take them out of its middle.
        const all = liveTabs();
        const i = all.indexOf(tab);
        const before = all[i - 1] && podOf(all[i - 1]);
        const after = all[i + 1] && podOf(all[i + 1]);
        if (before && before === after) {
          withBusy(() => gBrowser.moveTabAfter(tab, membersOf(before).at(-1)));
        }
      }
      update();
    }, 0);
  }

  function onTabClose(e) {
    if (e.target.hasAttribute("tabpods")) {
      setTimeout(() => {
        dropEmptyPods();
        update();
      }, 0);
    }
  }

  function onTabMove(e) {
    if (!busy && !restoring) {
      movedTabs.add(e.target);
    }
    scheduleUpdate();
  }

  function onStripMutation(records) {
    if (restoring) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.localName == "tab" && !openedTabs.has(node)) {
          movedTabs.add(node);
        }
      }
    }
    if (movedTabs.size) {
      scheduleUpdate();
    }
  }

  function onTabPinToggled(e) {
    if (!busy && !restoring && e.target.hasAttribute("tabpods")) {
      pinToggledTabs.add(e.target);
    }
    scheduleUpdate();
  }

  function onTabRestoring(e) {
    readTab(e.target);
    scheduleUpdate();
  }

  function onWindowRestored() {
    restoring = false;
    movedTabs.clear();
    pinToggledTabs.clear();
    loadState();
    liveTabs().forEach(readTab);
    update();
    applyCollapsed();
  }

  function init() {
    tabs = gBrowser.tabContainer;
    patchAllTabs();
    // A sheet of the browser document itself: a data: sheet loaded through
    // windowUtils drops chrome-only properties such as -moz-window-dragging.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    buildTabContextMenu();
    buildCapsuleMenu();

    for (const type of ["mousedown", "mouseup", "click", "dblclick", "auxclick"]) {
      window.addEventListener(type, onCapsuleMouse, true);
    }
    tabs.addEventListener("TabSelect", onTabSelect);
    tabs.addEventListener("TabOpen", onTabOpen);
    tabs.addEventListener("TabClose", onTabClose);
    tabs.addEventListener("TabMove", onTabMove);
    // A tab moved across a capsule only keeps its index, and Firefox sends no
    // TabMove for it, so watch the tab containers too.
    stripObserver = new MutationObserver(onStripMutation);
    for (const container of [tabs.pinnedTabsContainer, tabs.arrowScrollbox]) {
      stripObserver.observe(container, {childList: true});
    }
    tabs.addEventListener("TabPinned", onTabPinToggled);
    tabs.addEventListener("TabUnpinned", onTabPinToggled);
    tabs.addEventListener("SSTabRestoring", onTabRestoring);
    window.addEventListener("SSWindowStateBusy", () => (restoring = true));
    window.addEventListener("SSWindowStateReady", onWindowRestored);

    onWindowRestored();

    window.TabPods = {pods, createPod, addToPod, removeFromPods, ungroupPod, collapse, expand, toggle, setColor, update};
  }

  if (gBrowserInit.delayedStartupFinished) {
    init();
  } else {
    const observer = subject => {
      if (subject == window) {
        Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
        init();
      }
    };
    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
  }
})();
