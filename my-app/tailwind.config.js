const themeColors = require("./theme-colors");

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Tamni režim uključuje klasa .dark na <html> (postavlja je skripta u public/index.html)
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Početna strana i navigacija (font je u paketu, učitava se u index.js)
        display: ['"Plus Jakarta Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
    backgroundColor: ({ theme }) => ({ ...theme("colors"), ...themeColors.backgroundColor }),
    textColor: ({ theme }) => ({ ...theme("colors"), ...themeColors.textColor }),
    borderColor: ({ theme }) => ({
      ...theme("colors"),
      ...themeColors.borderColor,
      DEFAULT: themeColors.borderColor.gray[200],
    }),
  },
  plugins: [
    ({ addBase }) => {
      addBase({
        ":root": themeColors.lightVars,
        ":root.dark": themeColors.darkVars,
      });
    },
  ],
}
