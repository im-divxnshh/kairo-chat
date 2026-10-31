import Foundation
import PDFKit

guard CommandLine.arguments.count == 2,
      let document = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])),
      !document.isLocked else {
    fputs("PDF could not be opened or is password protected.\n", stderr)
    exit(1)
}
var pages: [String] = []
for index in 0..<min(document.pageCount, 500) {
    if let text = document.page(at: index)?.string { pages.append(text) }
}
let text = pages.joined(separator: "\n\n")
guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    fputs("This PDF has no extractable text. Attach page screenshots for visual analysis.\n", stderr)
    exit(2)
}
print(String(text.prefix(800000)))
