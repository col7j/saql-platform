/** @type {import('tailwindcss').Config} */
// كل القيم تُقرأ من src/tokens.css (مصدر واحد للرموز)
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]));
const status = (name) => scale(name, [50, 100, 200, 500, 600, 700, 800]);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-sans)'] },
      // النص 16، الصغير 14 (لا نص أصغر)، العنوان الصغير 20، الثانوي 32-36، الرئيسي 48-56
      fontSize: {
        xs: ['14px', { lineHeight: '1.6' }],
        sm: ['16px', { lineHeight: '1.7' }],
        base: ['16px', { lineHeight: '1.7' }],
        lg: ['20px', { lineHeight: '1.3' }],
        xl: ['20px', { lineHeight: '1.3' }],
        '2xl': ['32px', { lineHeight: '1.3' }],
        '3xl': ['36px', { lineHeight: '1.3' }],
        '4xl': ['48px', { lineHeight: '1.25' }],
        '5xl': ['56px', { lineHeight: '1.2' }],
      },
      // العناوين 600 والنص 400 (الخط لا يحمل أثقل من 600 هنا)
      fontWeight: { bold: '600', extrabold: '600', black: '600' },
      colors: {
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        accent: scale('accent', [50, 100, 300, 400, 500, 600, 700]),
        ink: scale('ink', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        // ألوان الحالات الوظيفية: الأخضر معتمد والأحمر مرفوض، بنسخ هادئة
        emerald: status('ok'),
        red: status('bad'),
        ok: status('ok'),
        bad: status('bad'),
        indigo: { 50: v('brand-50'), 700: v('brand-800') },
        surface: v('surface'),
      },
      borderRadius: { '2xl': 'var(--r-card)', xl: 'var(--r-field)', table: 'var(--r-table)', '3xl': '24px' },
      boxShadow: { card: 'var(--shadow-soft)', lift: 'var(--shadow-lift)' },
      maxWidth: { container: 'var(--container)' },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, rgb(var(--c-brand-600)) 0%, rgb(var(--c-brand-700)) 100%)',
        'accent-grad': 'linear-gradient(135deg, rgb(var(--c-accent-500)) 0%, rgb(var(--c-accent-400)) 100%)',
        'brand-deep': 'linear-gradient(135deg, rgb(var(--c-ink-900)) 0%, rgb(var(--c-brand-700)) 60%, rgb(var(--c-brand-600)) 100%)',
        // التوهّج الناعم من الثانوي بشفافية 8-12%
        glow: 'radial-gradient(60% 50% at 50% 0%, rgb(var(--c-brand-400) / 0.12) 0%, transparent 70%), radial-gradient(40% 40% at 90% 30%, rgb(var(--c-brand-400) / 0.08) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
};
