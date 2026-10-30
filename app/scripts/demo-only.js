// عرض فيه فقرة الديمو وحدها (للقطات الجولة): globalThis.DEMO_OPTS يغيّر إعداداتها
(async () => {
  const { saveConfig } = await import('/src/show/storage.ts');
  const { DEFAULT_CONFIG, DEMO_DEFAULTS, DEMO_SCENES } = await import('/src/show/model.ts');
  const settings = { scenes: [...DEMO_SCENES], ...DEMO_DEFAULTS, autoplay: false, ...(globalThis.DEMO_OPTS ?? {}) };
  saveConfig({ ...DEFAULT_CONFIG, theme: globalThis.REVIEW_THEME === 'light' ? 'light' : 'dark', segments: [{ id: 'seg_demo', type: 'demo', title: 'جولة في المنصة', order: 0, settings }] });
  return settings.scenes.length;
})();
