// عرض مراجعة فيه كل أنواع الشرائح والعناصر، للقطات 1920×1080 (يُنفَّذ في صفحة من خادم التطوير عبر shoot.mjs).
// يولّد صورة وفيديو تجريبيين بالمتصفح نفسه ويحفظهما محلياً مثل الرفع من المحرّر، ثم يحفظ العرض في show-config.
(async () => {
  const { putLocalFile, listLocalFiles, deleteLocalFile } = await import('/src/show/media.ts');
  // مكتبة نظيفة في كل تشغيل
  for (const f of await listLocalFiles()) await deleteLocalFile(f.id);
  const { saveConfig, loadRepoConfig } = await import('/src/show/storage.ts');
  const { templateSegment } = await import('/src/show/slides/templates.ts');
  const { makeElement } = await import('/src/show/slides/model.ts');
  const { BRAND_COLORS } = await import('/src/show/brand/brand.ts');
  const C = Object.fromEntries(Object.entries(BRAND_COLORS).map(([k, v]) => [k, v.hex]));

  // صورة تجريبية: تدرّج من ألوان الهوية مع أشكال، بحجم 1600×1000
  const photo = document.createElement('canvas');
  photo.width = 1600;
  photo.height = 1000;
  let g = photo.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1600, 1000);
  grad.addColorStop(0, C.tealDeep);
  grad.addColorStop(1, C.sky);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = C.gold;
  g.beginPath(); g.arc(1180, 360, 180, 0, 7); g.fill();
  g.fillStyle = C.white;
  g.font = '700 90px "Thmanyah Sans"';
  g.textAlign = 'center';
  g.fillText('صورة تجريبية', 800, 560);
  const png = await new Promise((r) => photo.toBlob(r, 'image/png'));
  const img = await putLocalFile(new File([png], 'photo.png', { type: 'image/png' }));

  // فيديو تجريبي 3 ثوانٍ بـ MediaRecorder
  const vc = document.createElement('canvas');
  vc.width = 1280;
  vc.height = 720;
  g = vc.getContext('2d');
  const rec = new MediaRecorder(vc.captureStream(30), { mimeType: 'video/webm' });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      g.fillStyle = C.night; g.fillRect(0, 0, 1280, 720);
      g.fillStyle = C.sky; g.fillRect(100 + t * 200, 260, 200, 200);
      g.fillStyle = C.white; g.font = '700 64px "Thmanyah Sans"'; g.textAlign = 'center'; g.fillText('فيديو تجريبي', 640, 620);
      t < 3 ? setTimeout(draw, 33) : resolve();
    };
    draw();
  });
  rec.stop();
  await done;
  const video = await putLocalFile(new File([new Blob(chunks, { type: 'video/webm' })], 'intro.webm', { type: 'video/webm' }));

  // شعار جمعية تجريبي: شارة دائرية بحروف، كأنه ملف رفعه المستخدم
  const lc = document.createElement('canvas');
  lc.width = 800;
  lc.height = 500;
  g = lc.getContext('2d');
  g.fillStyle = C.teal; g.beginPath(); g.arc(400, 210, 170, 0, 7); g.fill();
  g.fillStyle = C.gold; g.beginPath(); g.arc(400, 210, 110, 0, 7); g.fill();
  g.fillStyle = C.white; g.font = '900 120px "Thmanyah Sans"'; g.textAlign = 'center'; g.fillText('ج', 400, 255);
  g.fillStyle = C.teal; g.font = '700 54px "Thmanyah Sans"'; g.fillText('جمعية تجريبية', 400, 460);
  const orgPng = await new Promise((r) => lc.toBlob(r, 'image/png'));
  const orgLogo = await putLocalFile(new File([orgPng], 'org-logo.png', { type: 'image/png' }));
  const partner = (src) => ({ kind: 'url', src });

  const repo = await loadRepoConfig();
  const demo = repo.segments.find((s) => s.type === 'demo');
  let n = 0;
  const id = () => `rv_${++n}`;
  const seg = (k, input, title) => ({ ...templateSegment(k, id(), 0, input), title: title ?? input?.title });

  const counter = seg('counters', { title: 'أثر البرنامج بالأرقام' }, 'عدّاد');
  const partners = seg('partners', { tiers: [
    { title: 'الشريك الذهبي', size: 'lg', logos: [partner('./brand/logo-horizontal.svg')] },
    { title: 'الشركاء', size: 'md', logos: [partner('./brand/logo-vertical.svg'), partner('./brand/logo-horizontal.svg'), partner('./brand/logo-icon.svg')] },
    { title: 'الداعمون', size: 'sm', logos: Array.from({ length: 7 }, (_, i) => partner(i % 2 ? './brand/logo-icon.svg' : './brand/logo-horizontal.svg')) },
  ] }, 'شركاء النجاح');

  const shapes = seg('blank', {}, 'أشكال');
  shapes.settings.elements = [
    makeElement('shape', 's1', { x: 0, y: 0, w: 760, h: 1080, anim: { type: 'start', delay: 0, duration: 1000 }, props: { fill: 'gradTeal', radius: 0 } }),
    makeElement('shape', 's2', { x: 520, y: 380, w: 320, h: 320, shadow: 'glow', anim: { type: 'scale', delay: 300, duration: 900 }, props: { shape: 'circle', fill: 'gold' } }),
    makeElement('text', 's3', { x: 960, y: 330, w: 864, h: 260, props: { text: 'صقل قادة الغد', size: 110, weight: 900, align: 'start' } }),
    makeElement('shape', 's4', { x: 1584, y: 610, w: 240, h: 8, anim: { type: 'end', delay: 400, duration: 900 }, props: { shape: 'line', fill: 'gradGold' } }),
    makeElement('text', 's5', { x: 960, y: 650, w: 864, h: 160, anim: { type: 'up', delay: 500, duration: 900 }, props: { text: 'نص بخط النص العادي وارتفاع سطر 1.6 من ملف الهوية، يظهر بعد العنوان.', size: 44, weight: 400, align: 'start', line: 1.6 } }),
    makeElement('shape', 's6', { x: 980, y: 860, w: 380, h: 110, rot: -4, shadow: 'soft', step: 1, props: { fill: 'orange', radius: 999 } }),
    makeElement('text', 's7', { x: 980, y: 885, w: 380, h: 60, rot: -4, step: 1, props: { text: 'تظهر مع النقرة', size: 40, weight: 700, color: 'ink' } }),
  ];

  const segments = [
    seg('opening', { title: 'حفل ختام برنامج صقل', org: 'جمعية تجريبية للتنمية', orgLogo }, 'الافتتاح'),
    seg('logo', { title: 'حفل برنامج صقل' }, 'الشعار'),
    seg('title', { title: 'عرض البرنامج', sub: 'برنامج تدريبي وتطويري يصقل المهارات ويبني الثقة' }, 'عنوان'),
    seg('image', { media: img }, 'صورة بإطار'),
    seg('image', { media: img, cover: true }, 'صورة بملء الشاشة'),
    seg('video', { title: 'فيديو المقدمة', media: video, video: { autoAdvance: false } }, 'فيديو'),
    seg('names', { title: 'المكرَّمون', names: ['أصيل نايف الجهني', 'عبدالعزيز محمد الأنصاري', 'البراء بشير شيخ النجارين'] }, 'أسماء'),
    counter,
    partners,
    shapes,
    seg('black', {}, 'شاشة سوداء'),
    ...(demo ? [demo] : []),
  ].map((s, i) => ({ ...s, order: i }));
  saveConfig({ ...repo, title: 'عرض المراجعة', theme: globalThis.REVIEW_THEME === 'light' ? 'light' : 'dark', segments });
  return segments.length;
})();
