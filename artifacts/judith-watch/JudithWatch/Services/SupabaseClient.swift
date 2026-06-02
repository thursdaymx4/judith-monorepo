import Foundation

// MARK: — Lightweight Supabase REST client (no SDK dependency)

actor SupabaseClient {
    static let shared = SupabaseClient()

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession

    private init() {
        baseURL = URL(string: Config.supabaseURL)!
        anonKey = Config.supabaseAnonKey
        session = URLSession(configuration: .default)
    }

    // MARK: — Auth

    struct AuthResponse: Codable {
        let access_token: String
        let refresh_token: String?
        let expires_in: Int?
        let user: AuthUser?
    }
    struct AuthUser: Codable { let id: String; let email: String? }

    func signIn(email: String, password: String) async throws -> AuthResponse {
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/v1/token"))
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.url?.append(queryItems: [URLQueryItem(name: "grant_type", value: "password")])
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        let (data, response) = try await session.data(for: req)
        try checkHTTP(response, data)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    // MARK: — Bills

    func fetchBills(token: String) async throws -> [Bill] {
        var comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/bills"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order",  value: "created_at.asc"),
        ]
        var req = URLRequest(url: comps.url!)
        req.setValue(anonKey,            forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: req)
        try checkHTTP(response, data)
        let decoder = JSONDecoder()
        return try decoder.decode([Bill].self, from: data)
    }

    func markPaid(billId: String, token: String) async throws {
        try await patch(billId: billId, body: ["status": "paid"], token: token)
    }

    func snooze(billId: String, token: String) async throws {
        let tomorrow = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86_400))
            .prefix(10)
        try await patch(billId: billId,
                        body: ["status": "snoozed", "snoozed_until": String(tomorrow)],
                        token: token)
    }

    // MARK: — Private helpers

    private func patch(billId: String, body: [String: String], token: String) async throws {
        var comps = URLComponents(url: baseURL.appendingPathComponent("rest/v1/bills"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "id", value: "eq.\(billId)")]
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "PATCH"
        req.setValue(anonKey,            forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal",   forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: req)
        try checkHTTP(response, data)
    }

    private func checkHTTP(_ response: URLResponse, _ data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if http.statusCode < 200 || http.statusCode >= 300 {
            let detail = String(data: data, encoding: .utf8) ?? "(no body)"
            throw URLError(.badServerResponse,
                           userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode): \(detail)"])
        }
    }
}
