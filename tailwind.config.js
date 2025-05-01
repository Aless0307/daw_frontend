/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-vertical': 'scan-vertical 2s ease-in-out infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'matrix': 'matrix 20s linear infinite',
        'data-flow': 'data-flow 15s linear infinite',
        'rotate-slow': 'rotate 15s linear infinite',
      },
      keyframes: {
        'scan-vertical': {
          '0%': {
            transform: 'translateY(0%)',
            opacity: '0',
          },
          '50%': {
            transform: 'translateY(100%)',
            opacity: '1',
          },
          '100%': {
            transform: 'translateY(0%)',
            opacity: '0',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        'glow': {
          '0%, 100%': {
            opacity: '1',
            filter: 'brightness(1)',
          },
          '50%': {
            opacity: '0.6',
            filter: 'brightness(1.2)',
          },
        },
        'matrix': {
          '0%': {
            backgroundPosition: '0% 0%',
          },
          '100%': {
            backgroundPosition: '100% 100%',
          },
        },
        'data-flow': {
          '0%': {
            transform: 'translateX(-50%) translateY(-50%)',
          },
          '100%': {
            transform: 'translateX(50%) translateY(50%)',
          },
        },
      },
      backgroundImage: {
        'grid-white': "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 0h1v20H1V0zM20 1v1H0V1h20z' fill='%23FFFFFF'/%3E%3C/svg%3E\")",
        'circuit': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10h80v80H10V10z' stroke='%2322D3EE' stroke-width='0.5'/%3E%3Cpath d='M30 10v80M50 10v80M70 10v80M10 30h80M10 50h80M10 70h80' stroke='%2322D3EE' stroke-width='0.2'/%3E%3C/svg%3E\")",
        'matrix-pattern': "repeating-linear-gradient(45deg, rgba(34, 211, 238, 0.1) 0px, rgba(34, 211, 238, 0.1) 1px, transparent 1px, transparent 10px)",
      },
    },
  },
  plugins: [],
}
