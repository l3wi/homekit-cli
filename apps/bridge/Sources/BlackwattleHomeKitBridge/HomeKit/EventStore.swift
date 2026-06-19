import Foundation

final class EventStore: @unchecked Sendable {
    static let shared = EventStore()

    private let lock = NSLock()
    private var entries: [[String: Any]] = []
    private let limit = 500

    func append(type: String, message: String, values: [String: Any] = [:]) {
        lock.lock()
        defer { lock.unlock() }

        var entry = values
        entry["id"] = UUID().uuidString
        entry["date"] = ISO8601DateFormatter().string(from: Date())
        entry["type"] = type
        entry["message"] = message
        entries.insert(entry, at: 0)
        if entries.count > limit {
            entries.removeLast(entries.count - limit)
        }
    }

    func list(limit requestedLimit: Int, since: String?, type: String?) -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }

        let sinceDate = since.flatMap { ISO8601DateFormatter().date(from: $0) }
        return entries.filter { entry in
            if let type, entry["type"] as? String != type { return false }
            if let sinceDate,
               let rawDate = entry["date"] as? String,
               let date = ISO8601DateFormatter().date(from: rawDate),
               date < sinceDate { return false }
            return true
        }.prefix(max(1, min(requestedLimit, 500))).map { $0 }
    }
}
