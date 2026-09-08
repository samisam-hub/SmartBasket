# SmartBasket Asset Library — Batch 1 (MVP)

Warm adult grocery/nutrition visual system matching the agreed reference.

## Palette
Primary #0F6B3F · Secondary #A7D36B · Accent #FFD14D · Orange #FF6B00 · Error #E63946 · Background #FFF8F0 · Text #1F2937.

## Use
- State illustrations contain no UI copy so localization stays in React Native.
- Splash: use `splash/splash-logo.png` on Expo background `#FFF8F0`.
- Product placeholder: use only when external product imagery is absent/unusable.

## Recommended display sizes
- Horizontal logo: 150–220 dp wide.
- Logo mark: 28–48 dp in headers.
- Empty/error/search states: 120–220 dp square.
- Product placeholder: fill image area with `resizeMode="contain"`.

## Android
- `app-icon.png`: launcher icon.
- `adaptive-icon-foreground.png` + `adaptive-icon-background.png`: adaptive layers.
- `monochrome-icon.png`: themed icon.

## Keep code-based
Do not use raster assets for buttons, chips, cards, inputs, navigation, standard UI icons, toggles, progress bars or alerts.
