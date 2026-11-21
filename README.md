# rmagnus-portfolio

Personal portfolio site, styled as a topographic field-survey sheet. The hero's contour map is generated in the browser from a seeded height field, with a summit under each featured project.

Plain HTML, CSS and JavaScript. No build step.

## Run locally

```sh
npx serve .
```

## Deploy

Import the repo in Vercel and keep the defaults: Framework "Other", no build command, output directory `.`.

## Files

- `index.html`: content
- `styles.css`: design tokens (light and dark "night sheet") and layout
- `map.js`: contour generation (value noise and marching squares) and the theme toggle
- `theme.js`: applies the saved theme before first paint (kept out of `index.html` so the CSP needs no inline-script hash)
- `vercel.json`: security headers (CSP, no framing, nosniff, referrer and permissions policy). New third-party resources must be added to the CSP.
