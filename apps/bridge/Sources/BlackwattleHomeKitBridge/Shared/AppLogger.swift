import OSLog

enum AppLogger {
    static let app = Logger(subsystem: "ad.blackwattle.homekit", category: "app")
    static let socket = Logger(subsystem: "ad.blackwattle.homekit", category: "socket")
    static let homekit = Logger(subsystem: "ad.blackwattle.homekit", category: "homekit")
    static let audit = Logger(subsystem: "ad.blackwattle.homekit", category: "audit")
}
