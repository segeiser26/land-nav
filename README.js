# Land Nav — MGRS Coordinate Tools

A small, self-contained website for land navigation:

- **Converter** — Lat/Long ⇄ MGRS, with a switch for 6-digit (100 m) or
  8-digit (10 m) grid output.
- **Range & Azimuth** — distance and azimuth (forward + back) between two
  points, entered as either an MGRS grid or `lat, lon`. Shows a compass
  dial and reports azimuth in degrees or mils.
- **DAY / NVG toggle** — light and dark themes.

Everything runs client-side in plain HTML/CSS/JS — no build step, no
server, no external API calls once the page (and its two Google Fonts)
have loaded. Coordinates never leave the device.

## Hosting it on GitHub Pages

1. Create a new GitHub repository (or use an existing one) and add these
   files to it: `index.html`, `css/style.css`, `js/geo.js`, `js/app.js`.
2. Push to the `main` branch.
3. On GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a
   branch**, pick branch **main** and folder **/ (root)**, then **Save**.
5. GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/` within a minute or
   two.

No other configuration is needed — there's no Jekyll config, no
dependencies to install, and no secrets.

## Running it locally

Just open `index.html` in a browser. If your browser blocks local
`file://` script loading, serve the folder instead, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Accuracy notes

- Coordinate conversion uses the standard WGS84 transverse Mercator
  series (the same math behind most MGRS tools) and is accurate to a
  few meters worldwide, degrading only very close to the poles.
- Distance and azimuth use the Vincenty geodesic inverse formula
  (accurate to millimeters on the WGS84 ellipsoid, matches published
  reference test cases).
- MGRS coverage is 80°S–84°N. Points in the UPS polar regions (beyond
  84°N or 80°S) aren't supported.

## Customizing

- Colors, fonts, and layout live in `css/style.css` as CSS custom
  properties at the top of the file (`:root` for DAY, `[data-theme='nvg']`
  for NVG) — easy to retint for a unit or a different display.
- All conversion math is isolated in `js/geo.js` with no dependencies,
  so it can be reused in other tools if needed.
