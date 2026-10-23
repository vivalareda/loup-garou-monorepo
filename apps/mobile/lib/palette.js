/**
 * The app's colors, taken from the moonlit-forest artwork. Plain CommonJS so
 * tailwind.config.js (classes like bg-ink-900, text-moon) and TypeScript
 * (gradients, placeholder colors) read the same values.
 */
const palette = {
  // Night sky / forest: backgrounds and surfaces, darkest first
  ink: {
    950: '#061114',
    900: '#0A1B20',
    800: '#10272D',
    700: '#18353C',
    600: '#24474F',
    500: '#3A5E66',
    400: '#6C8C92',
    300: '#9BB4B8',
    200: '#C9D8DA',
  },
  // The full moon: primary actions and highlights
  moon: {
    DEFAULT: '#E8DCB2',
    100: '#F7F1DE',
    300: '#EFE5C6',
    500: '#D6C58A',
    700: '#8F8255',
  },
  // Danger, deaths, werewolves
  blood: {
    DEFAULT: '#C8483F',
    300: '#F0978E',
    900: '#3A1412',
  },
  // Daytime phases
  dawn: {
    DEFAULT: '#F2B35E',
    300: '#F8D3A0',
  },
  // Love, Cupid
  rose: {
    DEFAULT: '#F06A8A',
  },
};

module.exports = { palette };
