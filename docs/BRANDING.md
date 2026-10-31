# Kairo artwork and animation

Kairo's original anime mascot has lavender hair, green eyes, a lime hoodie and a pink sparkle. It replaces the lettermark in the application icon, sign-in screen, sidebar and welcome screen. The editable artwork is [mascot.svg](../src/assets/branding/mascot.svg); the native raster drawing is [draw.swift](../scripts/branding/draw.swift). No image-generation service or API is used.

## Preview

- [App icon](../src/assets/branding/icon.png)
- [DMG background](../build/dmg-background.png)
- [Animated setup guide](../build/Start%20here.html) — open locally in a browser to preview.

The dark installer design uses lime, lavender and pink, with “your next idea. starts here.” as the headline. The DMG places Kairo and Applications on two matching panels and includes **Start here.html**, an offline animated guide with a floating mascot, blinking eyes, a sparkle and a moving arrow. Finder supports a static background; the HTML guide provides the animation. The guide has a pause button and respects browser reduced-motion preferences.

The Windows EXE uses an assisted NSIS installer with matching header/sidebar artwork, install-directory selection and Kairo shortcuts. The MSI uses the same application icon and Kairo shortcut name.

## Running app

The macOS Dock icon cycles through 32 prebuilt frames at four updates per second. The character blinks and its sparkle moves. Active tasks advance the frames twice as fast. Windows updates each open window's icon and a 16-pixel taskbar overlay. Pinned or closed shortcuts use the static icon managed by the operating system.

Disable this in **Settings → Appearance → Animate Dock / taskbar icon**. Kairo's **Reduced motion** setting and the operating system's reduced-motion preference also stop the animation. Closing all windows or quitting clears the timer and restores the static Dock icon / clears Windows overlays. Opening a new window refreshes the preference; changes to OS motion preferences during animation are checked at each frame. Sign-in and welcome animations respect reduced motion too. Changing the displayed app name preserves the existing user-data directory.

## Rebuild

Prebuilt ICNS, ICO, PNG frames and installer BMPs are included, so Windows builds do not require Swift. To regenerate artwork on macOS with Xcode command-line tools:

```sh
npm run build:brand
npm run check
npm test
npm run dist:mac:arm64
# Or dist:mac:x64 for an Intel Mac.
```

Before packaging, Kairo validates icon container sizes, all 32 distinct frames, both DMG background resolutions, classic 24-bit NSIS artwork and the complete offline guide. Assets are bundled without environment or CLI credential files.

Run `npm test` to check the current suite. The [branding tests](../tests/branding.test.js) verify the launcher lifecycle, Windows overlays, reduced motion, failure handling and guide controls. Actual Dock/taskbar rendering and installer installation need native desktop checks listed in [USER_CHECKS.md](USER_CHECKS.md); automated tests do not establish those results.

## GitHub artwork

The README uses an eight-second GIF loop derived from the same mascot frames, with a static alternative and a 1280 × 640 social preview. See [README asset instructions](assets/README.md) for files and the macOS rebuild command. These are brand illustrations, not application screenshots.
