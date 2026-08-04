/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: '#5b4bff',
        'primary-hover': '#4938e6',
        secondary: '#eef1ff',

        // Accent (Amber CTA)
        cta: '#ffc107',
        'cta-hover': '#e6ac00',
        'cta-text': '#4a3500',

        // Status
        danger: '#ff6b6b',
        success: '#22c55e',
        warning: '#f59e0b',

        // Neutrals — backgrounds
        'bg-main': '#f8f9fc',
        'bg-card': '#ffffff',
        'bg-soft': '#eef1ff',
        'bg-nav': '#ffffff',

        // Neutrals — text
        'text-primary': '#1f2937',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',

        // Neutrals — borders
        border: '#e5e7eb',
        divider: '#eef2f7',

        // Role tints
        'primary-soft': '#eef1ff',
        'primary-muted': '#c7d2fe',
        'danger-soft': '#fef2f2',
        'danger-text': '#dc2626',
        'success-soft': '#f0fdf4',
        'success-text': '#15803d',
        'warning-soft': '#fffbeb',
        'warning-text': '#92400e',
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
    },
  },
  plugins: [],
}

