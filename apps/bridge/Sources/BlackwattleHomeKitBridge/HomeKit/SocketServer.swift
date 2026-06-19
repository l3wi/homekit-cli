import Darwin
import Foundation
import UIKit

final class SocketServer: @unchecked Sendable {
    static let shared = SocketServer()

    private var serverFD: Int32 = -1
    private var acceptSource: DispatchSourceRead?
    private let queue = DispatchQueue(label: "ad.blackwattle.homekit.socket", qos: .userInitiated)

    func start() {
        queue.async { self.bindAndListen() }
    }

    func stop() {
        queue.sync {
            acceptSource?.cancel()
            acceptSource = nil
            if serverFD >= 0 { close(serverFD) }
            serverFD = -1
            unlink(AppConfig.socketPath)
        }
    }

    private func bindAndListen() {
        let path = AppConfig.socketPath
        let directory = URL(fileURLWithPath: path).deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
        } catch {
            AppLogger.socket.error("Failed to prepare socket directory: \(error.localizedDescription)")
        }

        unlink(path)
        serverFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard serverFD >= 0 else {
            AppLogger.socket.error("Failed to create socket")
            return
        }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutablePointer(to: &addr.sun_path) { pointer in
            path.withCString { cString in
                _ = memcpy(pointer, cString, min(path.utf8.count, MemoryLayout.size(ofValue: pointer.pointee) - 1))
            }
        }

        let bindResult = withUnsafePointer(to: &addr) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(serverFD, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bindResult == 0 else {
            AppLogger.socket.error("Failed to bind socket errno=\(errno)")
            close(serverFD)
            serverFD = -1
            return
        }

        chmod(path, 0o600)
        guard listen(serverFD, 16) == 0 else {
            AppLogger.socket.error("Failed to listen errno=\(errno)")
            close(serverFD)
            serverFD = -1
            return
        }

        let flags = fcntl(serverFD, F_GETFL)
        _ = fcntl(serverFD, F_SETFL, flags | O_NONBLOCK)

        let source = DispatchSource.makeReadSource(fileDescriptor: serverFD, queue: queue)
        let fdToClose = serverFD
        source.setEventHandler { [weak self] in self?.acceptConnection() }
        source.setCancelHandler {
            if fdToClose >= 0 { close(fdToClose) }
        }
        source.resume()
        acceptSource = source
        AppLogger.socket.info("Socket server listening at \(path)")
    }

    private func acceptConnection() {
        let clientFD = accept(serverFD, nil, nil)
        guard clientFD >= 0 else { return }

        guard isSameUser(clientFD) else {
            AppLogger.socket.warning("Rejected socket client with mismatched UID")
            close(clientFD)
            return
        }

        let flags = fcntl(clientFD, F_GETFL)
        if flags != -1 { _ = fcntl(clientFD, F_SETFL, flags & ~O_NONBLOCK) }

        DispatchQueue.global(qos: .userInitiated).async {
            self.readRequestAndRespond(fd: clientFD)
        }
    }

    private func isSameUser(_ fd: Int32) -> Bool {
        var uid: uid_t = 0
        var gid: gid_t = 0
        guard getpeereid(fd, &uid, &gid) == 0 else { return true }
        return uid == geteuid()
    }

    private func readRequestAndRespond(fd: Int32) {
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)

        while data.count < 1_048_576 {
            let count = recv(fd, &buffer, buffer.count, 0)
            if count <= 0 { break }
            data.append(buffer, count: count)
            if buffer.prefix(count).contains(10) { break }
        }

        guard !data.isEmpty else {
            close(fd)
            return
        }
        Task {
            let response = await self.processRequest(data)
            _ = response.withCString { cString in
                send(fd, cString, strlen(cString), 0)
            }
            close(fd)
        }
    }

    private func processRequest(_ data: Data) async -> String {
        do {
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = object["id"] as? String,
                  let method = object["method"] as? String
            else {
                return encode(id: "unknown", error: BridgeRpcError(code: "INVALID_REQUEST", message: "Invalid request envelope"))
            }
            let params = object["params"] as? [String: Any] ?? [:]
            let payload = try await dispatch(method: method, params: params)
            return encode(id: id, data: payload)
        } catch let error as BridgeRpcError {
            return encode(id: "unknown", error: error)
        } catch {
            return encode(id: "unknown", error: BridgeRpcError(code: "UNKNOWN", message: error.localizedDescription))
        }
    }

    private func dispatch(method: String, params: [String: Any]) async throws -> Any {
        let homekit = HomeKitManager.shared
        switch method {
        case "hello":
            let clientProtocol = params["protocolVersion"] as? String ?? "0.0.0"
            guard clientProtocol.split(separator: ".").first == AppConfig.protocolVersion.split(separator: ".").first else {
                throw BridgeRpcError(code: "PROTOCOL_VERSION_MISMATCH", message: "Client protocol \(clientProtocol) is incompatible with bridge protocol \(AppConfig.protocolVersion)")
            }
            return homekit.capabilities()
        case "status":
            return await homekit.status()
        case "homes.list":
            return await homekit.listHomes()
        case "rooms.list":
            return await homekit.listRooms(homeId: params["homeId"] as? String)
        case "rooms.create":
            guard let name = params["name"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "name is required")
            }
            return try await homekit.createRoom(name: name, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "rooms.rename":
            guard let roomId = params["roomId"] as? String, let newName = params["newName"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "roomId and newName are required")
            }
            return try await homekit.renameRoom(roomId: roomId, newName: newName, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "rooms.remove":
            guard let roomId = params["roomId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "roomId is required")
            }
            return try await homekit.removeRoom(roomId: roomId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "rooms.assign":
            guard let accessoryId = params["accessoryId"] as? String, let roomId = params["roomId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "accessoryId and roomId are required")
            }
            return try await homekit.assignRoom(accessoryId: accessoryId, roomId: roomId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "accessories.list":
            return await homekit.listAccessories(
                homeId: params["homeId"] as? String,
                room: params["room"] as? String,
                category: params["category"] as? String)
        case "accessories.get":
            guard let accessoryId = params["accessoryId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "accessoryId is required")
            }
            return try await homekit.getAccessory(accessoryId: accessoryId, noRefresh: params["noRefresh"] as? Bool ?? false)
        case "accessories.search":
            guard let query = params["query"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "query is required")
            }
            return await homekit.searchAccessories(query: query, category: params["category"] as? String)
        case "accessories.control":
            guard let accessoryId = params["accessoryId"] as? String,
                  let characteristic = params["characteristic"] as? String,
                  let value = params["value"] as? String
            else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "accessoryId, characteristic, and value are required")
            }
            return try await homekit.control(
                accessoryId: accessoryId,
                characteristic: characteristic,
                value: value,
                serviceType: params["serviceType"] as? String,
                allowActuation: params["allowActuation"] as? Bool ?? false)
        case "accessories.remove":
            guard let accessoryId = params["accessoryId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "accessoryId is required")
            }
            return try await homekit.removeAccessory(accessoryId: accessoryId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "scenes.list":
            return await homekit.listScenes(homeId: params["homeId"] as? String)
        case "scenes.get":
            guard let sceneId = params["sceneId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "sceneId is required")
            }
            return try await homekit.getScene(sceneId: sceneId)
        case "scenes.delete":
            guard let sceneId = params["sceneId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "sceneId is required")
            }
            return try await homekit.deleteScene(sceneId: sceneId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "zones.list":
            return await homekit.listZones(homeId: params["homeId"] as? String)
        case "zones.create":
            guard let name = params["name"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "name is required")
            }
            return try await homekit.createZone(name: name, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "zones.remove":
            guard let zoneId = params["zoneId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "zoneId is required")
            }
            return try await homekit.removeZone(zoneId: zoneId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "zones.addRoom":
            guard let zoneId = params["zoneId"] as? String, let roomId = params["roomId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "zoneId and roomId are required")
            }
            return try await homekit.updateZoneRoom(zoneId: zoneId, roomId: roomId, homeId: params["homeId"] as? String, adding: true, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "zones.removeRoom":
            guard let zoneId = params["zoneId"] as? String, let roomId = params["roomId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "zoneId and roomId are required")
            }
            return try await homekit.updateZoneRoom(zoneId: zoneId, roomId: roomId, homeId: params["homeId"] as? String, adding: false, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "automations.list":
            return await homekit.listAutomations(homeId: params["homeId"] as? String)
        case "automations.get":
            guard let automationId = params["automationId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "automationId is required")
            }
            return try await homekit.getAutomation(automationId: automationId, homeId: params["homeId"] as? String)
        case "automations.delete":
            guard let automationId = params["automationId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "automationId is required")
            }
            return try await homekit.deleteAutomation(automationId: automationId, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "automations.enable":
            guard let automationId = params["automationId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "automationId is required")
            }
            return try await homekit.setAutomationEnabled(automationId: automationId, homeId: params["homeId"] as? String, enabled: true, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "automations.disable":
            guard let automationId = params["automationId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "automationId is required")
            }
            return try await homekit.setAutomationEnabled(automationId: automationId, homeId: params["homeId"] as? String, enabled: false, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "automations.rewire":
            guard let automationId = params["automationId"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "automationId is required")
            }
            return try await homekit.rewireAutomation(automationId: automationId, homeId: params["homeId"] as? String, addSceneIds: params["addSceneIds"] as? [String] ?? [], removeSceneIds: params["removeSceneIds"] as? [String] ?? [], allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "automations.create", "automations.createTime", "automations.addCondition", "scenes.import", "scenes.update":
            throw BridgeRpcError(code: "NOT_IMPLEMENTED", message: "\(method) is present in the CLI schema but bridge implementation is still pending")
        case "rename":
            guard let kind = params["kind"] as? String, let objectId = params["id"] as? String, let newName = params["newName"] as? String else {
                throw BridgeRpcError(code: "MISSING_ARGUMENT", message: "kind, id, and newName are required")
            }
            return try await homekit.rename(kind: kind, objectId: objectId, newName: newName, homeId: params["homeId"] as? String, allowMutation: params["allowMutation"] as? Bool ?? false, dryRun: params["dryRun"] as? Bool ?? false)
        case "deviceMap.get":
            return await homekit.deviceMap(homeId: params["homeId"] as? String)
        case "events.list":
            return homekit.events(
                limit: params["limit"] as? Int ?? 50,
                since: params["since"] as? String,
                type: params["type"] as? String)
        case "bridge.stop":
            DispatchQueue.main.async {
                UIApplication.shared.perform(NSSelectorFromString("terminate:"), with: nil)
            }
            return ["stopped": true]
        default:
            throw BridgeRpcError(code: "UNKNOWN_METHOD", message: "Unknown method: \(method)")
        }
    }

    private func encode(id: String, data: Any) -> String {
        serialize(["id": id, "ok": true, "data": data])
    }

    private func encode(id: String, error: BridgeRpcError) -> String {
        var errorObject: [String: Any] = ["code": error.code, "message": error.message]
        if let details = error.details { errorObject["details"] = details }
        return serialize(["id": id, "ok": false, "error": errorObject])
    }

    private func serialize(_ object: [String: Any]) -> String {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8)
        else {
            return "{\"id\":\"unknown\",\"ok\":false,\"error\":{\"code\":\"SERIALIZATION_FAILED\",\"message\":\"Failed to encode response\"}}\n"
        }
        return string + "\n"
    }
}
