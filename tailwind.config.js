/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Base del lienzo: tonos "bone"/lino, muy difuminados.
        canvas: "#F4F2EC",
        surface: "#FFFFFF",
        "surface-soft": "#FAF8F3",
        "surface-sunk": "#EFEBE2",
        line: "#E7E2D7",
        "line-soft": "#F0ECE3",
        // Texto: verde profundo en lugar de negro puro.
        ink: {
          DEFAULT: "#2B342E",
          soft: "#5A685F",
          muted: "#8C978E",
        },
        // Verde salvia desaturado (color principal).
        sage: {
          50: "#F2F6F2",
          100: "#E4EDE5",
          200: "#C8DCCB",
          300: "#A4C5AB",
          400: "#7DA487",
          500: "#5F8668",
          600: "#4C6B54",
          700: "#3E5645",
          800: "#33453A",
          900: "#2B3A31",
        },
        // Terracota suave (acento / acciones secundarias).
        clay: {
          50: "#FCF4EF",
          100: "#F8E6DA",
          200: "#F0CBB5",
          300: "#E4A98A",
          400: "#D68A67",
          500: "#C4764F",
          600: "#A85F3E",
          700: "#8A4C34",
          800: "#6F3F2D",
          900: "#5B3527",
        },
        // Azul polvo (informativo).
        sky: {
          50: "#F1F5F8",
          100: "#E1EAF0",
          200: "#C4D6E1",
          300: "#9EBBCB",
          400: "#789CB0",
          500: "#5C8096",
          600: "#4A6879",
          700: "#3D5462",
          800: "#344652",
          900: "#2E3B45",
        },
        // Ámbar trigo (avisos).
        wheat: {
          50: "#FDF8ED",
          100: "#FAEDD0",
          200: "#F2D89E",
          300: "#E8BF65",
          400: "#D9A441",
          500: "#C48C2E",
          600: "#A06E24",
          700: "#7E5620",
          800: "#66461F",
          900: "#553B1C",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
        22: "5.5rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(43, 52, 46, 0.04), 0 8px 24px rgba(43, 52, 46, 0.06)",
        card: "0 1px 2px rgba(43, 52, 46, 0.05), 0 12px 32px rgba(43, 52, 46, 0.08)",
        lift: "0 2px 4px rgba(43, 52, 46, 0.05), 0 18px 48px rgba(43, 52, 46, 0.12)",
        none: "0 0 #0000",
      },
      maxWidth: {
        shell: "1280px",
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
