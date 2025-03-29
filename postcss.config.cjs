module.exports = {
  plugins: [
    require('@tailwindcss/postcss')(),  // ✅ usa el plugin correcto para Tailwind 4
    require('autoprefixer'),
  ],
};
