# README and GitHub artwork

These assets use Kairo's existing mascot frames. They are decorative brand artwork, not screenshots of the application.

| File | Use |
| --- | --- |
| [kairo-hero.gif](kairo-hero.gif) | Animated README hero: 32 frames, eight-second loop, 1280 × 640. |
| [kairo-hero.png](kairo-hero.png) | Static alternative to the animated hero. |
| [social-preview.png](social-preview.png) | GitHub social preview: 1280 × 640 PNG. |

The GIF is checked in and works as a normal GitHub README image. It does not need JavaScript, an external animation service, or secrets. GitHub does not provide per-image reduced-motion controls for an embedded GIF; the README links directly to the still version. The design uses gentle movement and a blinking terminal cursor.

## Rebuild on macOS

With Xcode Command Line Tools installed, run these from the project root:

```sh
mkdir -p .native-cache/readme-modules
swiftc -module-cache-path .native-cache/readme-modules scripts/branding/readme.swift -o .native-cache/readme-art
.native-cache/readme-art .
```

The generator uses AppKit and ImageIO and reads `src/assets/branding/frames/frame-00.png` through `frame-31.png`. It only writes the three assets above. Windows contributors can use the checked-in assets without Swift.

The original mascot and these derived assets are covered by the project's [MIT license](../../LICENSE).
