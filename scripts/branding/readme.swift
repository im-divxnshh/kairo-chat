// Rebuild the README GIF and GitHub social preview with existing Kairo artwork.
// macOS: swiftc -module-cache-path .native-cache/readme-modules scripts/branding/readme.swift -o .native-cache/readme-art && .native-cache/readme-art .
import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".").standardizedFileURL
let assets = root.appendingPathComponent("docs/assets")
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
let width = 1280, height = 640
func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: alpha)
}
let ink = color(0xF8F5FF), muted = color(0xA7A6BA), lime = color(0xCEFA79), lavender = color(0xB8A1F5), pink = color(0xF29DE5)
func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ radius: CGFloat, _ fill: NSColor, _ stroke: NSColor? = nil) {
    let path = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w, height: h), xRadius: radius, yRadius: radius)
    fill.setFill(); path.fill()
    if let stroke { stroke.setStroke(); path.lineWidth = 1; path.stroke() }
}
func label(_ text: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ tint: NSColor, _ weight: NSFont.Weight = .regular, mono: Bool = false) {
    let font = mono ? NSFont.monospacedSystemFont(ofSize: size, weight: weight) : NSFont.systemFont(ofSize: size, weight: weight)
    (text as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: [.font: font, .foregroundColor: tint])
}
func star(_ x: CGFloat, _ y: CGFloat, _ radius: CGFloat, _ tint: NSColor) {
    let path = NSBezierPath()
    for i in 0..<8 {
        let angle = CGFloat(i) * .pi / 4, r = i % 2 == 0 ? radius : radius * 0.28
        let point = NSPoint(x: x + cos(angle) * r, y: y + sin(angle) * r)
        if i == 0 { path.move(to: point) } else { path.line(to: point) }
    }
    path.close(); tint.setFill(); path.fill()
}
func frame(_ index: Int) throws -> CGImage {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: width * 4, bitsPerPixel: 32),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create bitmap") }
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = context
    defer { NSGraphicsContext.restoreGraphicsState() }
    color(0x11121B).setFill(); NSRect(x: 0, y: 0, width: width, height: height).fill()
    let phase = CGFloat(index) / 32 * .pi * 2
    // A quiet dot grid and a softly tinted portrait panel.
    for x in stride(from: 30, to: width, by: 28) {
        for y in stride(from: 24, to: height, by: 28) {
            color(0xB8A1F5, 0.09).setFill(); NSBezierPath(ovalIn: NSRect(x: x, y: y, width: 2, height: 2)).fill()
        }
    }
    box(24, 24, 1232, 592, 28, color(0x161722), color(0x30303F))
    box(786, 88, 422, 464, 32, color(0x211E31), color(0x3B344B))
    label("K /", 68, 558, 24, lime, .bold, mono: true)
    label("YOUR NEXT IDEA STARTS HERE", 128, 562, 13, muted, .medium, mono: true)
    box(1070, 556, 138, 30, 15, color(0xCEFA79, 0.1))
    label("OPEN SOURCE", 1085, 565, 12, lime, .semibold, mono: true)
    label("Kairo", 66, 392, 112, ink, .heavy)
    label("less tab chaos.", 72, 329, 44, ink, .bold)
    label("more main character energy.", 72, 279, 38, lavender, .bold)
    label("Your AI workspace. Your CLI. Your flow.", 74, 224, 21, muted)
    box(74, 143, 653, 54, 14, color(0x0E1018), color(0x343445))
    label(">", 96, 160, 20, lime, .bold, mono: true)
    label("chat / code / create", 126, 160, 18, ink, .medium, mono: true)
    if index % 8 < 5 { box(357, 158, 9, 24, 1, lime) }
    let chips: [(String, CGFloat, CGFloat, NSColor)] = [("CODEX", 74, 94, lime), ("CLAUDE CODE", 180, 148, lavender), ("OLLAMA", 340, 108, pink)]
    for (text, x, w, tint) in chips {
        box(x, 88, w, 32, 16, tint.withAlphaComponent(0.08), tint.withAlphaComponent(0.22))
        label(text, x + 15, 97, 12, tint, .semibold, mono: true)
    }
    let mascotURL = root.appendingPathComponent(String(format: "src/assets/branding/frames/frame-%02d.png", index))
    guard let mascot = NSImage(contentsOf: mascotURL) else { fatalError("Missing mascot frame") }
    let float = sin(phase) * 7
    mascot.draw(in: NSRect(x: 831, y: 174 + float, width: 330, height: 330))
    star(826, 470, 16 + sin(phase) * 3, pink)
    star(1174, 221, 14 - sin(phase) * 3, lime)
    star(1158, 490, 8, lavender)
    box(852, 122, 292, 40, 20, color(0x15151F), color(0x3B344B))
    lime.withAlphaComponent(0.7 + sin(phase) * 0.25).setFill()
    NSBezierPath(ovalIn: NSRect(x: 873, y: 138, width: 8, height: 8)).fill()
    label("ready when inspiration hits", 892, 134, 13, ink, .medium, mono: true)
    label("DESKTOP AI, WITH PERSONALITY.", 74, 47, 11, muted, .medium, mono: true)
    label("macOS + Windows", 1054, 47, 11, muted, .medium, mono: true)
    guard let image = bitmap.cgImage else { fatalError("Cannot create image") }
    return image
}
let gifURL = assets.appendingPathComponent("kairo-hero.gif")
guard let gif = CGImageDestinationCreateWithURL(gifURL as CFURL, UTType.gif.identifier as CFString, 32, nil) else { fatalError("Cannot create GIF") }
CGImageDestinationSetProperties(gif, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for index in 0..<32 {
    let image = try frame(index)
    CGImageDestinationAddImage(gif, image, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 0.25]] as CFDictionary)
    if index == 0 {
        for name in ["kairo-hero.png", "social-preview.png"] {
            guard let png = CGImageDestinationCreateWithURL(assets.appendingPathComponent(name) as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot create PNG") }
            CGImageDestinationAddImage(png, image, nil)
            guard CGImageDestinationFinalize(png) else { fatalError("Cannot write PNG") }
        }
    }
}
guard CGImageDestinationFinalize(gif) else { fatalError("Cannot write GIF") }
print("Generated 32-frame README GIF, static hero and 1280 x 640 GitHub social preview.")
