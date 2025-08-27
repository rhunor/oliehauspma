/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // OliveHaus Brand Colors
        primary: {
          50: '#f7f8f3',
          100: '#e8ecd9',
          200: '#d1dab3',
          300: '#b4c184',
          400: '#9ba95e',
          500: '#6B7C3B', // Main brand color
          600: '#5a6832',
          700: '#48522a',
          800: '#3c4425',
          900: '#343a22',
          950: '#1a1e11',
        },
        secondary: {
          50: '#fefdf3',
          100: '#fef9e3',
          200: '#fdf2c8',
          300: '#fbe6a0',
          400: '#f8d571',
          500: '#D4AF37', // Warm gold
          600: '#c19a1f',
          700: '#a1801a',
          800: '#85681c',
          900: '#71561e',
          950: '#422e0f',
        },
        neutral: {
          50: '#fdfdf9',
          100: '#fafaf6',
          200: '#f5f5dc', // Cream
          300: '#eeeedd',
          400: '#e1e1c8',
          500: '#d4d4aa',
          600: '#c0c088',
          700: '#a8a06b',
          800: '#8b8358',
          900: '#73704a',
          950: '#3e3d26',
        },
        dark: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#454545',
          900: '#2C2C2C', // Main dark color
          950: '#262626',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideInFromTop: {
          from: { transform: 'translateY(-10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        slideInFromLeft: {
          from: { transform: 'translateX(-10px)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
      
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        fadeIn: "fadeIn 0.3s ease-out",
        slideInFromTop: "slideInFromTop 0.3s ease-out",
        slideInFromLeft: "slideInFromLeft 0.3s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}