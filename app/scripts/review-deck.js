// عرض مراجعة فيه كل أنواع الشرائح والعناصر، للقطات 1920×1080 (يُنفَّذ في صفحة من خادم التطوير عبر shoot.mjs).
// يولّد صورة وفيديو تجريبيين بالمتصفح نفسه ويحفظهما محلياً مثل الرفع من المحرّر، ثم يحفظ العرض في show-config.
(async () => {
  const { putLocalFile } = await import('/src/show/media.ts');
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

  const repo = await loadRepoConfig();
  const demo = repo.segments.find((s) => s.type === 'demo');
  let n = 0;
  const id = () => `rv_${++n}`;
  const seg = (k, input, title) => ({ ...templateSegment(k, id(), 0, input), title: title ?? input?.title });

  const counter = seg('title', { title: 'أثر البرنامج', sub: '' }, 'عدّاد');
  counter.settings.elements = [
    makeElement('text', 'c1', { x: 96, y: 170, w: 1728, h: 130, props: { text: 'أثر البرنامج بالأرقام', size: 96, weight: 900 } }),
    makeElement('counter', 'c2', { x: 160, y: 400, w: 700, h: 260, props: { from: 0, to: 120, suffix: '+', size: 200 } }),
    makeElement('text', 'c3', { x: 160, y: 680, w: 700, h: 70, anim: { type: 'up', delay: 300, duration: 900 }, props: { text: 'مشاركاً', size: 44, weight: 400 } }),
    makeElement('counter', 'c4', { x: 1060, y: 400, w: 700, h: 260, anim: { type: 'up', delay: 200, duration: 900 }, props: { from: 0, to: 36, size: 200, color: 'sky' } }),
    makeElement('text', 'c5', { x: 1060, y: 680, w: 700, h: 70, anim: { type: 'up', delay: 500, duration: 900 }, props: { text: 'رحلة ولقاء', size: 44, weight: 400 } }),
  ];

  const partners = seg('blank', {}, 'شركاء النجاح');
  partners.settings.elements = [
    makeElement('text', 'p1', { x: 96, y: 80, w: 1728, h: 130, props: { text: 'شركاء النجاح', size: 96, weight: 900 } }),
    makeElement('logoGrid', 'p2', { x: 160, y: 260, w: 1600, h: 720, props: { tiers: [
      { title: 'الشريك الذهبي', size: 'lg', logos: [{ kind: 'url', src: './brand/logo-horizontal.svg' }] },
      { title: 'الداعمون', size: 'md', logos: [{ kind: 'url', src: './brand/logo-vertical.svg' }, { kind: 'url', src: './brand/logo-icon.svg' }, { kind: 'url', src: './brand/logo-horizontal.svg' }] },
    ] } }),
  ];

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
    seg('logo', { title: 'حفل برنامج صقل' }, 'الافتتاح'),
    seg('title', { title: 'عرض البرنامج', sub: 'برنامج تدريبي وتطويري يصقل المهارات ويبني الثقة' }, 'عنوان'),
    seg('image', { media: img }, 'صورة بإطار'),
    seg('image', { media: img, cover: true }, 'صورة بملء الشاشة'),
    seg('video', { title: 'فيديو المقدمة', media: video, video: { autoAdvance: false } }, 'فيديو'),
    seg('names', { title: 'المكرَّمون', names: ['يوسف الرحيلي', 'عبدالرحمن السالم', 'محمد الأنصاري'] }, 'أسماء'),
    counter,
    partners,
    shapes,
    seg('black', {}, 'شاشة سوداء'),
    ...(demo ? [demo] : []),
  ].map((s, i) => ({ ...s, order: i }));
  saveConfig({ ...repo, title: 'عرض المراجعة', segments });
  return segments.length;
})();
