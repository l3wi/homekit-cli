import Foundation

enum AppConfig {
    static let bridgeVersion = "0.1.0"
    static let protocolVersion = "1.0.0"
    static let appGroupIdentifier = "group.ad.blackwattle.homekit"
    static let socketFileName = "bridge.sock"

    static var socketPath: String {
        let env = ProcessInfo.processInfo.environment
        if let override = env["HOMEKIT_SOCKET_PATH"], !override.isEmpty {
            return override
        }
        if env["HOMEKIT_USE_TMP_SOCKET"] == "1" {
            return URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("ad.blackwattle.homekit.sock")
                .path
        }
        if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            return container.appendingPathComponent(socketFileName).path
        }
        return URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("ad.blackwattle.homekit.sock")
            .path
    }
}
