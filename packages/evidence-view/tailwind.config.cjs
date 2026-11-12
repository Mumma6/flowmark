module.exports = {
  content: ["./src/**/*.{ts,tsx}", "../ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          "background",
          "foreground",
          "card",
          "primary",
          "secondary",
          "muted",
          "accent",
          "destructive",
          "border",
          "input",
          "ring",
          "success",
          "warning",
          "info",
        ].map((name) => [
          name,
          name === "card" ||
          ["primary", "secondary", "muted", "accent", "destructive"].includes(
            name,
          )
            ? {
                DEFAULT: `hsl(var(--${name}))`,
                foreground: `hsl(var(--${name}-foreground))`,
              }
            : `hsl(var(--${name}))`,
        ]),
      ),
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
