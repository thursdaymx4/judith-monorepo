import UIKit
import UniformTypeIdentifiers

/// Share extension that accepts a single image (Photos / Safari / screenshot
/// share) and hands it off to the host app's receipt-scan flow.
///
/// Flow:
///   1. Extract the first image attachment from extensionContext.
///   2. Downscale + JPEG-encode so the App Group blob stays small.
///   3. Persist as base64 + metadata in App Group UserDefaults under
///      `judith.pendingReceiptShare`.
///   4. Open `judith:///receipt-scan?pending=1` so expo-router routes the host
///      app straight to the receipt-scan screen, which reads the payload via
///      the judith-receipt-vision `consumePendingShare()` bridge.
///
/// The extension UI is invisible — we complete as fast as possible so the
/// user lands in the host app where the OCR / matcher / confirm sheet lives.
final class ShareViewController: UIViewController {
    private static let appGroupID = "group.com.app.judith"
    private static let pendingKey = "judith.pendingReceiptShare"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        view.alpha = 0.0
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { await processShare() }
    }

    private func processShare() async {
        guard let provider = firstImageProvider() else {
            cancelExtension()
            return
        }

        guard let image = await loadImage(from: provider) else {
            cancelExtension()
            return
        }

        // Cap at 1600px on the longer edge and 0.75 JPEG quality. Receipt
        // OCR doesn't gain accuracy above ~1200px and the App Group blob
        // is much friendlier under a few hundred KB.
        guard let data = downscaledJPEG(from: image, maxDimension: 1600, quality: 0.75) else {
            cancelExtension()
            return
        }

        let id = UUID().uuidString
        persistPending(id: id, base64: data.base64EncodedString())
        await openHost(pendingId: id)
        completeExtension()
    }

    // MARK: — Attachment extraction

    private func firstImageProvider() -> NSItemProvider? {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            return nil
        }
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.canLoadObject(ofClass: UIImage.self)
                    || provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    return provider
                }
            }
        }
        return nil
    }

    private func loadImage(from provider: NSItemProvider) async -> UIImage? {
        if provider.canLoadObject(ofClass: UIImage.self),
           let image = await loadImageObject(from: provider) {
            return image
        }

        return await withCheckedContinuation { (cont: CheckedContinuation<UIImage?, Never>) in
            provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, _ in
                if let url = item as? URL,
                   let data = try? Data(contentsOf: url),
                   let image = UIImage(data: data) {
                    cont.resume(returning: image)
                    return
                }
                if let image = item as? UIImage {
                    cont.resume(returning: image)
                    return
                }
                if let data = item as? Data, let image = UIImage(data: data) {
                    cont.resume(returning: image)
                    return
                }
                cont.resume(returning: nil)
            }
        }
    }

    private func loadImageObject(from provider: NSItemProvider) async -> UIImage? {
        await withCheckedContinuation { (cont: CheckedContinuation<UIImage?, Never>) in
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                cont.resume(returning: object as? UIImage)
            }
        }
    }

    // MARK: — Downscale

    private func downscaledJPEG(from image: UIImage, maxDimension: CGFloat, quality: CGFloat) -> Data? {
        let size = image.size
        let longest = max(size.width, size.height)
        let scale = longest > maxDimension ? maxDimension / longest : 1.0
        let target = CGSize(width: size.width * scale, height: size.height * scale)

        let renderer = UIGraphicsImageRenderer(size: target)
        let rendered = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return rendered.jpegData(compressionQuality: quality)
    }

    // MARK: — App Group handoff

    private func persistPending(id: String, base64: String) {
        guard let defaults = UserDefaults(suiteName: Self.appGroupID) else { return }
        let payload: [String: Any] = [
            "id": id,
            "base64": base64,
            "mime": "image/jpeg",
            "createdAt": Date().timeIntervalSince1970,
        ]
        defaults.set(payload, forKey: Self.pendingKey)
        defaults.synchronize()
    }

    // MARK: — Open host app

    private func openHost(pendingId: String) async {
        let url = URL(string: "judith:///receipt-scan?pending=1&id=\(pendingId)")!
        let opened = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            extensionContext?.open(url) { ok in
                cont.resume(returning: ok)
            }
        }
        if opened { return }

        // Fallback for extension hosts that refuse NSExtensionContext.open.
        var responder: UIResponder? = self
        let selector = sel_registerName("openURL:")
        while let next = responder {
            if next.responds(to: selector) {
                _ = next.perform(selector, with: url)
                return
            }
            responder = next.next
        }
    }

    // MARK: — Lifecycle

    private func completeExtension() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    private func cancelExtension() {
        extensionContext?.cancelRequest(withError: NSError(
            domain: "JudithShare",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "Couldn't read that image"]
        ))
    }
}
