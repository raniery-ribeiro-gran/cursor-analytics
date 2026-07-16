import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gran: {
          red: "#DD303E",
          lime: "#CAFF39",
          navy: "#001533",
          blue: "#0045AD",
          bg: "#F5F7FA",
          surface: "#FFFFFF",
          text: "#212529",
          muted: "#6C757D",
          success: "#076E4F",
          "success-bg": "#E6F7F1",
        },
      },
      fontFamily: {
        montserrat: ["var(--font-montserrat)", "sans-serif"],
        "source-sans": ["var(--font-source-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
