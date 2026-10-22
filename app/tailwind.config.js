/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Thmanyah Sans', 'system-ui', 'sans-serif'] },
      colors: {
        // مستخرجة من ملفات الشعار الرسمية
        brand: {
          50: '#e8f6f9', 100: '#cdeef3', 200: '#9fdde8', 300: '#5fc8da', 400: '#00b9d1',
          500: '#008fa8', 600: '#00708c', 700: '#005c73', 800: '#004a5d', 900: '#06384a',
        },
        accent: { 50: '#fff6e8', 100: '#feeacb', 300: '#fcc76a', 400: '#fbb42b', 500: '#f79845', 600: '#dd7a26', 700: '#b45d14' },
        ink: { 50: '#f6f7f8', 100: '#eceef0', 200: '#d9dcdf', 300: '#b9bdc1', 400: '#919498', 500: '#74777b', 600: '#5a5d61', 700: '#3f4246', 800: '#2a2c2f', 900: '#17191b' },
      },
      boxShadow: { card: '0 1px 2px rgba(6,56,74,.06), 0 4px 16px rgba(6,56,74,.05)' },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#00708c 0%,#008fa8 55%,#00b9d1 100%)',
        'accent-grad': 'linear-gradient(135deg,#f79845 0%,#fbb42b 100%)',
        'brand-deep': 'linear-gradient(135deg,#06384a 0%,#00708c 50%,#008fa8 100%)',
      },
    },
  },
  plugins: [],
};
