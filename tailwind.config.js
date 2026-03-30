/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        fh: {
          bg:       '#0d1117',
          surface:  '#161b22',
          elevated: '#1c2128',
          overlay:  '#21262d',
          muted:    '#30363d',
          border:   '#30363d',
          'border-hover': '#484f58',
          text:     '#e6edf3',
          'text-secondary': '#8b949e',
          'text-muted': '#6e7681',
          accent:   '#58a6ff',
          'accent-emphasis': '#388bfd',
          green:    '#3fb950',
          'green-muted': '#238636',
          red:      '#f85149',
          'red-muted': '#da3633',
          purple:   '#bc8cff',
          yellow:   '#d29922',
          orange:   '#db6d28',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'fade-out':   'fadeOut 0.2s ease-in',
        'slide-up':   'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':    'shimmer 1.5s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow':  'spin 1.2s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeOut:   { from: { opacity: '1' }, to: { opacity: '0' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      boxShadow: {
        'fh':       '0 0 0 1px rgba(48,54,61,0.6)',
        'fh-lg':    '0 8px 24px rgba(1,4,9,0.75)',
        'fh-inset': 'inset 0 1px 0 rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
};
