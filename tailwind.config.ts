import daisyui from 'daisyui';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  plugins: [daisyui],
  daisyui: {
    themes: ['light', 'dark'],
  },
};
