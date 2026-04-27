// Dynamic Wallpaper — Command Registry
// Manages all searchable commands with fuzzy matching, scoring, and persistence

const commandRegistry = {
  _commands: new Map(),
  _fuse: null,
  _recentIds: [],
  _useCounts: {},

  register(item) {
    this._commands.set(item.id, item);
    this._rebuildIndex();
  },

  registerAll(items) {
    for (const item of items) this._commands.set(item.id, item);
    this._rebuildIndex();
  },

  unregister(id) {
    this._commands.delete(id);
    this._rebuildIndex();
  },

  _rebuildIndex() {
    const list = this._getVisible();
    this._fuse = new Fuse(list, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "keywords", weight: 0.2 },
        { name: "group", weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });
  },

  _getVisible() {
    const items = [];
    for (const cmd of this._commands.values()) {
      if (cmd.context && !cmd.context()) continue;
      items.push(cmd);
    }
    return items;
  },

  search(query) {
    if (!query || !this._fuse) return this._getDefaultResults();
    const raw = this._fuse.search(query);
    return raw.slice(0, 10).map((r) => ({
      item: r.item,
      score: this._compositeScore(r),
    })).sort((a, b) => b.score - a.score);
  },

  _compositeScore(fuseResult) {
    const fuzzy = 1 - (fuseResult.score || 0);
    const id = fuseResult.item.id;
    const recencyIdx = this._recentIds.indexOf(id);
    const recency = recencyIdx >= 0 ? 1 - recencyIdx / 10 : 0;
    const maxUse = Math.max(1, ...Object.values(this._useCounts));
    const frequency = (this._useCounts[id] || 0) / maxUse;
    const weight = fuseResult.item.weight || 0.5;
    return 0.6 * fuzzy + 0.2 * recency + 0.15 * frequency + 0.05 * weight;
  },

  _getDefaultResults() {
    const all = this._getVisible();
    return all.map((item) => ({ item, score: 0.5 }));
  },

  recordUse(id) {
    this._recentIds = [id, ...this._recentIds.filter((r) => r !== id)].slice(0, 10);
    this._useCounts[id] = (this._useCounts[id] || 0) + 1;
    this._persist();
  },

  getRecent() {
    return this._recentIds
      .map((id) => this._commands.get(id))
      .filter((c) => c && (!c.context || c.context()))
      .slice(0, 5);
  },

  getFrequent() {
    return Object.entries(this._useCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this._commands.get(id))
      .filter((c) => c && (!c.context || c.context()))
      .slice(0, 5);
  },

  _persist() {
    api.save_config({
      cmd_recent: this._recentIds,
      cmd_counts: this._useCounts,
    });
  },

  restore(cfg) {
    this._recentIds = cfg.cmd_recent || [];
    this._useCounts = cfg.cmd_counts || {};
  },
};

function initCommandRegistry() {
  commandRegistry.restore(config);
  commandRegistry._commands.clear();
  commandRegistry.registerAll([
    // Navigation
    { id: "nav.library", title: t("nav.library"), keywords: ["wallpaper", "images", "folder", "bilder", "bibliothek"], group: t("cmd.group.pages"), handler: () => navigateTo("library") },
    { id: "nav.schedule", title: t("nav.schedule"), keywords: ["time", "schedule", "zeitplan", "timer"], group: t("cmd.group.pages"), handler: () => navigateTo("schedule") },

    // Settings
    { id: "settings.general", title: t("cmd.general_settings"), keywords: ["autostart", "tray", "theme", "dark", "light", "sidebar", "language", "sprache", "darstellung", "allgemein"], group: t("cmd.group.settings"), shortcut: "Ctrl+,", handler: () => openSettings("general") },
    { id: "settings.about", title: t("cmd.about"), keywords: ["version", "changelog", "update", "info", "über"], group: t("cmd.group.settings"), handler: () => openSettings("about") },

    // Actions
    { id: "action.sidebar", title: t("cmd.toggle_sidebar"), keywords: ["collapse", "expand", "hide", "seitenleiste"], group: t("cmd.group.actions"), shortcut: "Ctrl+B", handler: () => cycleSidebarMode() },
    { id: "action.theme.toggle", title: t("cmd.toggle_theme"), keywords: ["theme", "switch", "mode", "design"], group: t("cmd.group.actions"), handler: () => setTheme(config.theme === "dark" ? "light" : "dark") },
    { id: "action.theme.dark", title: t("cmd.dark_mode"), keywords: ["dark", "night", "dunkel"], group: t("cmd.group.actions"), context: () => config.theme !== "dark", handler: () => setTheme("dark") },
    { id: "action.theme.light", title: t("cmd.light_mode"), keywords: ["light", "day", "bright", "hell"], group: t("cmd.group.actions"), context: () => config.theme !== "light", handler: () => setTheme("light") },
    { id: "action.language", title: t("cmd.change_language"), keywords: ["language", "sprache", "deutsch", "english", "locale"], group: t("cmd.group.actions"), handler: () => openSettings("general") },

    // DW-specific actions
    { id: "action.browse_folder", title: t("cmd.browse_folder"), keywords: ["folder", "ordner", "wallpaper", "browse", "durchsuchen"], group: t("cmd.group.actions"), handler: () => onBrowseFolder() },
    { id: "action.toggle_lockscreen", title: t("cmd.toggle_lockscreen"), keywords: ["lock", "screen", "sperrbildschirm", "sync"], group: t("cmd.group.actions"), handler: () => { const el = document.getElementById("lockscreen_toggle"); if (el) { el.checked = !el.checked; el.dispatchEvent(new Event("change")); } } },
    { id: "action.shortcuts", title: t("cmd.shortcuts"), keywords: ["shortcut", "keyboard", "tastenkürzel", "tastatur"], group: t("cmd.group.actions"), shortcut: "?", handler: () => toggleShortcuts() },
    { id: "action.check_updates", title: t("cmd.check_updates"), keywords: ["update", "version", "aktualisieren"], group: t("cmd.group.actions"), handler: () => openSettings("about") },

    // Help
    { id: "support.ask", title: t("cmd.ask_question"), keywords: ["help", "support", "faq", "chat", "hilfe", "frage"], group: t("cmd.group.help"), handler: () => typeof openSupport === "function" && openSupport("ask") },
    { id: "support.bug", title: t("cmd.report_bug"), keywords: ["bug", "issue", "problem", "error", "crash", "fehler"], group: t("cmd.group.help"), handler: () => typeof openSupport === "function" && openSupport("bug") },
  ]);
}
