const STORAGE_KEYS = {
  markets: "shiireMemo.markets",
  logs: "shiireMemo.logs",
  session: "shiireMemo.session",
};

const DEFAULT_MARKETS = [];

const state = {
  markets: loadMarkets(),
  logs: loadJson(STORAGE_KEYS.logs, []),
  session: loadJson(STORAGE_KEYS.session, null),
};

const elements = {
  screens: {
    setup: document.getElementById("setup-screen"),
    entry: document.getElementById("entry-screen"),
    market: document.getElementById("market-screen"),
  },
  setupForm: document.getElementById("setup-form"),
  sessionDate: document.getElementById("session-date"),
  marketSelect: document.getElementById("market-select"),
  setupMarketHelp: document.getElementById("setup-market-help"),
  startEntryButton: document.getElementById("start-entry-button"),
  openMarketSettings: document.getElementById("open-market-settings"),
  closeMarketSettings: document.getElementById("close-market-settings"),
  backToSetup: document.getElementById("back-to-setup"),
  sessionSummary: document.getElementById("session-summary"),
  grandTotal: document.getElementById("grand-total"),
  subtotal: document.getElementById("subtotal"),
  feeTotal: document.getElementById("fee-total"),
  entryForm: document.getElementById("entry-form"),
  quickInput: document.getElementById("quick-input"),
  noteInput: document.getElementById("note-input"),
  toggleNote: document.getElementById("toggle-note"),
  noteFieldWrapper: document.getElementById("note-field-wrapper"),
  entryError: document.getElementById("entry-error"),
  historyList: document.getElementById("history-list"),
  historyEmpty: document.getElementById("history-empty"),
  finishSession: document.getElementById("finish-session"),
  exportCsv: document.getElementById("export-csv"),
  clearDayEntries: document.getElementById("clear-day-entries"),
  marketForm: document.getElementById("market-form"),
  marketName: document.getElementById("market-name"),
  marketFeeType: document.getElementById("market-fee-type"),
  marketFeeValue: document.getElementById("market-fee-value"),
  marketList: document.getElementById("market-list"),
  marketEmpty: document.getElementById("market-empty"),
};

init();

function init() {
  const today = todayString();

  if (state.session?.date && state.session.date !== today) {
    const previousDate = state.session.date;
    const previousLogs = state.logs.filter((log) => (
      log.date === previousDate && log.marketId === state.session.marketId
    ));

    if (previousLogs.length) {
      window.confirm(
        `${previousDate} の入力が残っています。CSV保存はしましたか？`
      );
    }

    state.session = null;
    persistSession();
  }

  elements.sessionDate.value = state.session?.date || today;
  renderMarketOptions();
  bindEvents();
  routeToInitialScreen();
}

function bindEvents() {
  elements.setupForm.addEventListener("submit", handleSessionStart);
  elements.openMarketSettings.addEventListener("click", () => showScreen("market"));
  elements.closeMarketSettings.addEventListener("click", () => showScreen("setup"));
  elements.backToSetup.addEventListener("click", () => showScreen("setup"));
  elements.entryForm.addEventListener("submit", handleEntrySubmit);
  elements.toggleNote.addEventListener("click", handleToggleNote);
  elements.finishSession.addEventListener("click", handleFinishSession);
  elements.exportCsv.addEventListener("click", handleExportCsv);
  elements.clearDayEntries.addEventListener("click", handleClearDayEntries);
  elements.marketForm.addEventListener("submit", handleMarketSubmit);

  document.addEventListener("focusin", handleFocusChange);
  document.addEventListener("focusout", handleFocusChange);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize);
  }
}

function routeToInitialScreen() {
  if (state.session && getSelectedMarket()) {
    renderSession();
    showScreen("entry");
    return;
  }

  showScreen("setup");
}

function handleSessionStart(event) {
  event.preventDefault();

  if (!state.markets.length) {
    showScreen("market");
    return;
  }

  state.session = {
    date: elements.sessionDate.value,
    marketId: elements.marketSelect.value,
  };

  persistSession();
  renderSession();
  showScreen("entry");
  elements.quickInput.focus();
}

function handleEntrySubmit(event) {
  event.preventDefault();
  elements.entryError.textContent = "";

  const quickValue = elements.quickInput.value.trim();
  if (!quickValue) {
    elements.entryError.textContent = "入力欄に「品目 価格」の形で入れてください。";
    elements.quickInput.focus();
    return;
  }

  const parsed = parseQuickEntry(quickValue);
  if (!parsed) {
    elements.entryError.textContent = "「品目 価格」の形で入力してください。";
    elements.quickInput.focus();
    return;
  }

  const log = {
    id: crypto.randomUUID(),
    date: state.session.date,
    marketId: state.session.marketId,
    itemName: parsed.itemName,
    amount: parsed.amount,
    note: elements.noteInput.value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.logs.unshift(log);
  persistLogs();
  renderSession();

  elements.quickInput.value = "";
  elements.noteInput.value = "";
  if (elements.noteFieldWrapper.hidden === false) {
    elements.noteFieldWrapper.hidden = true;
    elements.toggleNote.textContent = "補足メモを開く";
  }
  elements.quickInput.focus();
}

function handleToggleNote() {
  const willOpen = elements.noteFieldWrapper.hidden;
  elements.noteFieldWrapper.hidden = !willOpen;
  elements.toggleNote.textContent = willOpen ? "補足メモを閉じる" : "補足メモを開く";

  if (willOpen) {
    elements.noteInput.focus();
  } else {
    elements.quickInput.focus();
  }
}

function handleClearDayEntries() {
  if (!state.session) {
    return;
  }

  const targetLogs = getCurrentLogs();
  if (!targetLogs.length) {
    return;
  }

  const shouldDelete = window.confirm(
    `${state.session.date} の ${targetLogs.length} 件を削除します。よろしいですか？`
  );

  if (!shouldDelete) {
    return;
  }

  const targetIds = new Set(targetLogs.map((log) => log.id));
  state.logs = state.logs.filter((log) => !targetIds.has(log.id));
  persistLogs();
  renderSession();
}

function handleExportCsv() {
  const market = getSelectedMarket();
  const logs = getCurrentLogs();

  if (!market || !logs.length) {
    return;
  }

  const rows = [
    ["date", "market", "item_name", "amount", "note", "created_at"],
    ...logs.map((log) => [
      log.date,
      market.name,
      log.itemName,
      String(log.amount),
      log.note || "",
      log.createdAt,
    ]),
  ];

  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeMarketName = market.name.replace(/[\\/:*?"<>|]/g, "_");

  link.href = url;
  link.download = `shiire-log-${state.session.date}-${safeMarketName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleFinishSession() {
  if (!state.session) {
    showScreen("setup");
    return;
  }

  const logs = getCurrentLogs();
  if (logs.length) {
    const shouldFinish = window.confirm(
      `${state.session.date} の入力を終了します。CSV保存はしましたか？`
    );

    if (!shouldFinish) {
      return;
    }
  }

  state.session = null;
  persistSession();
  elements.sessionDate.value = todayString();
  renderMarketOptions();
  showScreen("setup");
}

function handleMarketSubmit(event) {
  event.preventDefault();

  const name = elements.marketName.value.trim();
  const feeType = elements.marketFeeType.value;
  const feeValue = Number(elements.marketFeeValue.value || 0);

  if (!name) {
    return;
  }

  const exists = state.markets.some((market) => market.name === name);
  if (exists) {
    return;
  }

  state.markets.push({
    id: crypto.randomUUID(),
    name,
    feeType,
    feeValue,
  });

  persistMarkets();
  renderMarketOptions();
  renderMarketList();
  elements.marketForm.reset();
  elements.marketFeeType.value = "rate";
}

function renderSession() {
  const market = getSelectedMarket();
  if (!market || !state.session) {
    return;
  }

  elements.sessionSummary.textContent = `${state.session.date} / ${market.name}`;

  const logs = getCurrentLogs();
  renderTotals(logs, market);
  renderHistory(logs);
}

function renderTotals(logs, market) {
  const subtotal = logs.reduce((sum, log) => sum + log.amount, 0);
  const fee = calculateFee(subtotal, market);
  const total = subtotal + fee;

  elements.subtotal.textContent = formatYen(subtotal);
  elements.feeTotal.textContent = formatYen(fee);
  elements.grandTotal.textContent = formatYen(total);
}

function renderHistory(logs) {
  elements.historyList.innerHTML = "";

  if (!logs.length) {
    elements.historyEmpty.hidden = false;
    return;
  }

  elements.historyEmpty.hidden = true;

  logs.forEach((log) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const row = document.createElement("div");
    row.className = "history-row";

    const itemName = document.createElement("p");
    itemName.className = "history-cell history-item-name";
    itemName.textContent = log.itemName;

    const amount = document.createElement("p");
    amount.className = "history-cell history-amount";
    amount.textContent = formatYen(log.amount);

    const note = document.createElement("p");
    note.className = "history-cell history-note";
    note.textContent = log.note || "-";

    const time = document.createElement("p");
    time.className = "history-cell history-time";
    time.textContent = formatTime(log.createdAt);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-button";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", () => {
      state.logs = state.logs.filter((entry) => entry.id !== log.id);
      persistLogs();
      renderSession();
    });

    row.append(itemName, amount, note, time, removeButton);
    item.appendChild(row);
    elements.historyList.appendChild(item);
  });
}

function renderMarketOptions() {
  elements.marketSelect.innerHTML = "";
  elements.setupMarketHelp.hidden = state.markets.length > 0;
  elements.startEntryButton.disabled = state.markets.length === 0;

  state.markets.forEach((market) => {
    const option = document.createElement("option");
    option.value = market.id;
    option.textContent = buildMarketLabel(market);
    elements.marketSelect.appendChild(option);
  });

  renderMarketList();

  const selectedId = state.session?.marketId;
  if (selectedId && state.markets.some((market) => market.id === selectedId)) {
    elements.marketSelect.value = selectedId;
    return;
  }

  if (state.markets[0]) {
    elements.marketSelect.value = state.markets[0].id;
  }
}

function renderMarketList() {
  elements.marketList.innerHTML = "";
  elements.marketEmpty.hidden = state.markets.length > 0;

  state.markets.forEach((market) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";

    const title = document.createElement("p");
    title.className = "history-title";
    title.textContent = market.name;

    const meta = document.createElement("p");
    meta.className = "history-meta";
    meta.textContent = buildMarketLabel(market);

    main.append(title, meta);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-button";
    removeButton.textContent = "削除";
    removeButton.disabled = state.markets.length === 1;
    removeButton.addEventListener("click", () => removeMarket(market.id));

    item.append(main, removeButton);
    elements.marketList.appendChild(item);
  });
}

function removeMarket(marketId) {
  state.markets = state.markets.filter((market) => market.id !== marketId);

  if (state.session?.marketId === marketId) {
    state.session.marketId = state.markets[0]?.id || null;
    persistSession();
  }

  persistMarkets();
  renderMarketOptions();
  renderSession();
}

function showScreen(name) {
  Object.entries(elements.screens).forEach(([screenName, screen]) => {
    screen.classList.toggle("screen-active", screenName === name);
  });
}

function handleFocusChange() {
  window.setTimeout(() => {
    const active = document.activeElement;
    const isEntryField = active === elements.quickInput || active === elements.noteInput;
    document.body.classList.toggle("keyboard-open", isEntryField);

    if (isEntryField) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, 50);
}

function handleViewportResize() {
  const active = document.activeElement;
  const isEntryField = active === elements.quickInput || active === elements.noteInput;

  if (!isEntryField) {
    return;
  }

  document.body.classList.add("keyboard-open");
}

function getCurrentLogs() {
  if (!state.session) {
    return [];
  }

  return state.logs.filter((log) => (
    log.date === state.session.date && log.marketId === state.session.marketId
  ));
}

function getSelectedMarket() {
  return state.markets.find((market) => market.id === state.session?.marketId) || null;
}

function calculateFee(subtotal, market) {
  if (!subtotal) {
    return 0;
  }

  if (market.feeType === "fixed") {
    return Math.round(market.feeValue);
  }

  return Math.round(subtotal * (market.feeValue / 100));
}

function parseQuickEntry(rawValue) {
  const normalized = rawValue.trim().replace(/,/g, "");
  const match = normalized.match(/^(.*?)(?:[\s　]*)(\d+(?:\.\d+)?)$/);

  if (!match) {
    return null;
  }

  const itemName = match[1].trim();
  const amount = Number(match[2]);

  if (!itemName || Number.isNaN(amount)) {
    return null;
  }

  return { itemName, amount: Math.round(amount) };
}

function buildMarketLabel(market) {
  if (market.feeType === "fixed") {
    return `${market.name} / 固定 ${formatYen(market.feeValue)}`;
  }

  return `${market.name} / ${market.feeValue}%`;
}

function formatYen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function escapeCsvCell(value) {
  const normalized = String(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

function loadMarkets() {
  const saved = loadJson(STORAGE_KEYS.markets, null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    return saved;
  }

  localStorage.setItem(STORAGE_KEYS.markets, JSON.stringify(DEFAULT_MARKETS));
  return [...DEFAULT_MARKETS];
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function persistMarkets() {
  localStorage.setItem(STORAGE_KEYS.markets, JSON.stringify(state.markets));
}

function persistLogs() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
}

function persistSession() {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
}

function todayString() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
