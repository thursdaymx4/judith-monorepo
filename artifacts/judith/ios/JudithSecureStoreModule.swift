import CryptoKit
import ExpoModulesCore
import Foundation
import Security

final class JudithSecureStoreModule: Module {
    private enum Config {
        static let service = "com.app.judith.securestore"
        static let storeEncryptionKeyAccount = "judith_store_encryption_key_v1"
    }

    func definition() -> ModuleDefinition {
        Name("JudithSecureStore")

        AsyncFunction("getItem") { (key: String) -> String? in
            try self.getItem(for: key)
        }

        AsyncFunction("setItem") { (key: String, value: String) in
            try self.setItem(value, for: key)
        }

        AsyncFunction("removeItem") { (key: String) in
            try self.removeItem(for: key)
        }

        AsyncFunction("encryptString") { (value: String) -> String in
            try self.encryptString(value)
        }

        AsyncFunction("decryptString") { (value: String) -> String in
            try self.decryptString(value)
        }
    }

    private func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Config.service,
            kSecAttrAccount as String: key,
        ]
    }

    private func getItem(for key: String) throws -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess:
            guard let data = result as? Data else { return nil }
            return String(data: data, encoding: .utf8)
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    private func setItem(_ value: String, for key: String) throws {
        let data = Data(value.utf8)
        let query = baseQuery(for: key)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            var createQuery = query
            attributes.forEach { createQuery[$0.key] = $0.value }
            let createStatus = SecItemAdd(createQuery as CFDictionary, nil)
            guard createStatus == errSecSuccess else {
                throw KeychainError.unexpectedStatus(createStatus)
            }
        default:
            throw KeychainError.unexpectedStatus(updateStatus)
        }
    }

    private func removeItem(for key: String) throws {
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    private func encryptString(_ value: String) throws -> String {
        let key = try encryptionKey()
        let plaintext = Data(value.utf8)
        let sealedBox = try AES.GCM.seal(plaintext, using: key)
        guard let combined = sealedBox.combined else {
            throw KeychainError.invalidCiphertext
        }
        return combined.base64EncodedString()
    }

    private func decryptString(_ value: String) throws -> String {
        guard let combined = Data(base64Encoded: value) else {
            throw KeychainError.invalidCiphertext
        }
        let key = try encryptionKey()
        let sealedBox = try AES.GCM.SealedBox(combined: combined)
        let plaintext = try AES.GCM.open(sealedBox, using: key)
        guard let string = String(data: plaintext, encoding: .utf8) else {
            throw KeychainError.invalidPlaintext
        }
        return string
    }

    private func encryptionKey() throws -> SymmetricKey {
        if let existing = try getData(for: Config.storeEncryptionKeyAccount) {
            return SymmetricKey(data: existing)
        }

        let key = SymmetricKey(size: .bits256)
        let data = key.withUnsafeBytes { Data($0) }
        try setData(data, for: Config.storeEncryptionKeyAccount)
        return key
    }

    private func getData(for key: String) throws -> Data? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess:
            return result as? Data
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    private func setData(_ data: Data, for key: String) throws {
        let query = baseQuery(for: key)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            var createQuery = query
            attributes.forEach { createQuery[$0.key] = $0.value }
            let createStatus = SecItemAdd(createQuery as CFDictionary, nil)
            guard createStatus == errSecSuccess else {
                throw KeychainError.unexpectedStatus(createStatus)
            }
        default:
            throw KeychainError.unexpectedStatus(updateStatus)
        }
    }
}

private enum KeychainError: LocalizedError {
    case unexpectedStatus(OSStatus)
    case invalidCiphertext
    case invalidPlaintext

    var errorDescription: String? {
        switch self {
        case .unexpectedStatus(let status):
            return "Keychain operation failed with status \(status)."
        case .invalidCiphertext:
            return "Encrypted payload is not a valid sealed box."
        case .invalidPlaintext:
            return "Decrypted payload is not valid UTF-8."
        }
    }
}
