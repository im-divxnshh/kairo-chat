import AppKit
import Foundation

let root = CommandLine.arguments[1]
var height: CGFloat = 1024
func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(calibratedRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: alpha)
}
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect { NSRect(x:x, y:height-y-h, width:w, height:h) }
func rounded(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat, _ fill: NSColor) {
    fill.setFill(); NSBezierPath(roundedRect:rect(x,y,w,h),xRadius:r,yRadius:r).fill()
}
func polygon(_ points: [(CGFloat,CGFloat)], _ fill: NSColor) {
    let p = NSBezierPath(); p.move(to:NSPoint(x:points[0].0,y:height-points[0].1))
    for point in points.dropFirst() { p.line(to:NSPoint(x:point.0,y:height-point.1)) }; p.close(); fill.setFill(); p.fill()
}
func star(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ angle: CGFloat, _ fill: NSColor) {
    let points = (0..<8).map { i -> (CGFloat,CGFloat) in
        let a = angle + CGFloat(i) * .pi / 4, radius = i % 2 == 0 ? r : r * 0.26
        return (x+cos(a)*radius,y+sin(a)*radius)
    }; polygon(points,fill)
}
func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ fill: NSColor, _ weight: NSFont.Weight = .regular) {
    let font = NSFont.systemFont(ofSize:size,weight:weight)
    (value as NSString).draw(at:NSPoint(x:x,y:height-y-size*1.18),withAttributes:[.font:font,.foregroundColor:fill])
}
func oval(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: NSColor) {
    fill.setFill();NSBezierPath(ovalIn:rect(x,y,w,h)).fill()
}
func icon(_ phase: CGFloat = 0) {
    rounded(74,74,876,876,224,color(0x15171C))
    let tile = NSBezierPath(roundedRect:rect(96,96,832,832),xRadius:208,yRadius:208)
    NSGradient(starting:color(0x302647),ending:color(0x16191E))!.draw(in:tile,angle:125)
    let glow=NSBezierPath(ovalIn:rect(176,181,672,672));color(0xB69FF8,0.08+0.025*(sin(phase)+1)).setFill();glow.fill()
    // Original chibi character: angular lavender hair, oversized anime eyes and a neon hoodie.
    polygon([(230,662),(211,490),(246,387),(231,319),(336,350),(397,230),(435,296),(550,252),(567,319),(676,280),(744,369),(798,365),(756,511),(780,632),(705,692),(286,692)],color(0x574378))
    polygon([(249,644),(237,489),(278,396),(266,356),(345,382),(402,284),(443,338),(548,292),(574,355),(669,322),(716,404),(758,401),(727,518),(748,616),(691,662),(311,662)],color(0xB8A1F5))
    rounded(251,674,522,200,105,color(0x303A2C));rounded(271,688,482,180,92,color(0xCEFA79))
    rounded(466,625,91,89,32,color(0xEDBAA8));rounded(304,377,416,308,143,color(0xFFD9C4))
    oval(282,511,56,89,color(0xFFD9C4));oval(689,511,56,89,color(0xFFD9C4))
    polygon([(283,432),(309,366),(410,331),(508,344),(577,327),(685,368),(731,438),(672,475),(630,405),(596,475),(546,395),(490,463),(467,399),(399,464),(377,409),(330,462)],color(0xB8A1F5))
    polygon([(352,363),(411,345),(456,350),(405,405)],color(0xD3C4FF));polygon([(548,352),(578,345),(637,365),(606,408)],color(0xD3C4FF))
    let blinking = phase > 5.1 && phase < 5.8
    for x in [CGFloat(406),CGFloat(617)] {
        if blinking { rounded(x-48,535,96,13,6,color(0x48344D)) }
        else {
            oval(x-49,486,98,118,color(0x3B3048));oval(x-31,502,62,98,color(0xA7DB74));oval(x-16,510,32,86,color(0x274039))
            oval(x-31,500,26,34,color(0xFFFCF4));oval(x+13,560,13,16,color(0xFFFCF4));rounded(x-44,487,91,9,4,color(0x48344D))
        }
    }
    rounded(330,597,52,15,7,color(0xF59DB6,0.65));rounded(644,597,52,15,7,color(0xF59DB6,0.65));rounded(505,584,14,7,3,color(0xEDBAA8))
    let smile=NSBezierPath();smile.move(to:NSPoint(x:494,y:height-620));smile.curve(to:NSPoint(x:530,y:height-620),controlPoint1:NSPoint(x:504,y:height-635),controlPoint2:NSPoint(x:520,y:height-635));smile.lineWidth=7;color(0x744B64).setStroke();smile.stroke()
    rounded(414,714,12,88,6,color(0x748D50));rounded(599,714,12,88,6,color(0x748D50));oval(491,751,42,42,color(0xA890E8));star(512,772,14,0,color(0xFFF6E8))
    star(785+sin(phase)*12,235+cos(phase)*8,57+sin(phase)*4,phase/4,color(0xF29DE5));star(213,726,21,-0.2,color(0xF29DE5))
}
func canvas(_ file: String, _ width: Int, _ high: Int, _ unitsW: CGFloat, _ unitsH: CGFloat, _ format: NSBitmapImageRep.FileType = .png, _ draw: () -> Void) throws {
    height=unitsH
    let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:high,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:width*4,bitsPerPixel:32)!
    let context=NSGraphicsContext(bitmapImageRep:rep)!
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=context
    context.cgContext.scaleBy(x:CGFloat(width)/unitsW,y:CGFloat(high)/unitsH)
    draw(); NSGraphicsContext.restoreGraphicsState()
    rep.size=NSSize(width:CGFloat(width),height:CGFloat(high))
    try rep.representation(using:format,properties:[:])!.write(to:URL(fileURLWithPath:root+"/"+file))
}
func background() {
    rounded(0,0,900,600,0,color(0x111317))
    for x in stride(from:CGFloat(20),through:900,by:36) { for y in stride(from:CGFloat(20),through:600,by:36) {
        rounded(x,y,2,2,1,color(0xB8B0D0,0.14))
    } }
    rounded(48,42,167,30,15,color(0xCEFA79)); text("KAIRO / LET'S GO",63,48,12,color(0x16171A),.bold)
    text("your next idea.",48,96,60,color(0xF2F0E9),.heavy)
    text("starts here.",48,163,60,color(0xCEFA79),.heavy)
    text("MAKE SPACE FOR SOMETHING GOOD.",50,240,12,color(0xB6AFC6),.semibold)
    star(772,143,75,-0.2,color(0xF29DE5)); star(704,204,21,0.12,color(0xB59BFC))
    text("kairo",720,42,30,color(0xF2F0E9),.bold)
    rounded(155,276,160,160,32,color(0x25262E)); rounded(550,276,160,160,32,color(0x25262E))
    // Finder icons are placed at (235,337) and (630,337), in 1x coordinates.
    rounded(367,332,88,10,5,color(0xCEFA79)); polygon([(449,310),(481,337),(449,364)],color(0xCEFA79))
    text("DRAG → DROP",366,287,13,color(0xCEFA79),.bold)
    text("01",123,285,12,color(0xB59BFC),.bold); text("02",720,285,12,color(0xF29DE5),.bold)
    text("Drag Kairo to Applications.",48,467,28,color(0xF2F0E9),.bold)
    text("Then open Kairo. Your next chapter is waiting.",50,510,15,color(0xB6AFC6))
    rounded(48,557,197,22,11,color(0x292B35)); text("A LITTLE SPACE TO CREATE",60,561,10,color(0xCEFA79),.semibold)
    text("ANIMATED GUIDE ↗",697,570,10,color(0xF29DE5),.bold)
}
try FileManager.default.createDirectory(atPath:root+"/build/icon.iconset",withIntermediateDirectories:true)
try FileManager.default.createDirectory(atPath:root+"/src/assets/branding/frames",withIntermediateDirectories:true)
for size in [16,24,32,48,64,128,256,512,1024] {
    try canvas("build/icon-\(size).png",size,size,1024,1024) { icon() }
}
try FileManager.default.copyItem(atPath:root+"/build/icon-1024.png",toPath:root+"/src/assets/branding/icon.png")
for frame in 0..<32 {
    let file=String(format:"src/assets/branding/frames/frame-%02d.png",frame)
    try canvas(file,256,256,1024,1024) { icon(CGFloat(frame)*2 * .pi/32) }
}
try canvas("build/dmg-background.png",900,600,900,600) { background() }
try canvas("build/dmg-background@2x.png",1800,1200,900,600) { background() }
try canvas("build/installer-sidebar.bmp",164,314,164,314,.bmp) {
    rounded(0,0,164,314,0,color(0x15171C));star(122,75,28,0,color(0xF29DE5));text("kairo",18,126,37,color(0xCEFA79),.heavy)
    text("your next",18,188,19,color(0xF2F0E9),.semibold);text("idea starts",18,214,19,color(0xF2F0E9),.semibold);text("here.",18,240,19,color(0xF2F0E9),.semibold)
}
try canvas("build/installer-header.bmp",150,57,150,57,.bmp) {
    rounded(0,0,150,57,0,color(0x15171C));text("kairo",15,9,30,color(0xCEFA79),.heavy);star(124,28,15,0,color(0xF29DE5))
}
print("Kairo icon, motion frames and installer artwork rendered.")
