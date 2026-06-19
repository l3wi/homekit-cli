import Foundation

struct AuditLog {
    static func record(action: String, payload: [String: Any]) -> String {
        let auditId = UUID().uuidString
        var entry = payload
        entry["audit_id"] = auditId
        entry["action"] = action
        entry["date"] = ISO8601DateFormatter().string(from: Date())

        do {
            let directory = try auditDirectory()
            let file = directory.appendingPathComponent("audit.jsonl")
            let data = try JSONSerialization.data(withJSONObject: entry, options: [.sortedKeys])
            if !FileManager.default.fileExists(atPath: file.path) {
                FileManager.default.createFile(atPath: file.path, contents: nil)
            }
            let handle = try FileHandle(forWritingTo: file)
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            try handle.write(contentsOf: Data("\n".utf8))
            try handle.close()
        } catch {
            AppLogger.audit.error("Failed to write audit entry: \(error.localizedDescription)")
        }

        return auditId
    }

    private static func auditDirectory() throws -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("BlackwattleHomeKitBridge", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
