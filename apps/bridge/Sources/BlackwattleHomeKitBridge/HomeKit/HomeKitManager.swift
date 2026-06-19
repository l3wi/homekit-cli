import Foundation
import HomeKit

final class HomeKitManager: NSObject, HMHomeManagerDelegate, HMAccessoryDelegate, @unchecked Sendable {
    static let shared = HomeKitManager()

    private var manager: HMHomeManager?
    private var readyContinuations: [CheckedContinuation<Void, Never>] = []
    private var isReady = false
    private let cacheLock = NSLock()
    private var cachedAccessories: [[String: Any]] = []
    private var cacheUpdatedAt: Date?
    private let writeQueue = DispatchQueue(label: "ad.blackwattle.homekit.control")

    var ready: Bool { isReady }

    func start() {
        guard manager == nil else { return }
        AppLogger.homekit.info("Creating HMHomeManager")
        let homeManager = HMHomeManager()
        homeManager.delegate = self
        manager = homeManager
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        AppLogger.homekit.info("HomeKit updated: \(manager.homes.count) home(s)")
        for home in manager.homes {
            for accessory in home.accessories {
                accessory.delegate = self
            }
        }
        refreshCache()
        isReady = true
        let continuations = readyContinuations
        readyContinuations.removeAll()
        continuations.forEach { $0.resume() }
        EventStore.shared.append(type: "homes_updated", message: "HomeKit homes updated", values: [
            "homes": manager.homes.count,
            "accessories": manager.homes.reduce(0) { $0 + $1.accessories.count },
        ])
    }

    func accessory(_ accessory: HMAccessory, service: HMService, didUpdateValueFor characteristic: HMCharacteristic) {
        EventStore.shared.append(type: "characteristic_change", message: "\(accessory.name).\(CharacteristicMapper.displayName(for: characteristic.characteristicType)) changed", values: [
            "accessoryName": accessory.name,
            "characteristic": CharacteristicMapper.displayName(for: characteristic.characteristicType),
            "value": characteristic.value ?? NSNull(),
        ])
    }

    func waitUntilReady() async {
        if isReady { return }
        await withCheckedContinuation { continuation in
            readyContinuations.append(continuation)
        }
    }

    func status() async -> [String: Any] {
        await waitUntilReady()
        let homes = manager?.homes ?? []
        let cache = cacheSnapshot()
        return [
            "ready": isReady,
            "bridgeVersion": AppConfig.bridgeVersion,
            "protocolVersion": AppConfig.protocolVersion,
            "homes": homes.count,
            "accessories": homes.reduce(0) { $0 + $1.accessories.count },
            "socketPath": AppConfig.socketPath,
            "cache": [
                "warmed": cache.count > 0,
                "accessoryCount": cache.count,
                "updatedAt": cache.updatedAt as Any,
            ],
        ]
    }

    func capabilities() -> [String: Any] {
        [
            "bridgeVersion": AppConfig.bridgeVersion,
            "protocolVersion": AppConfig.protocolVersion,
            "features": ["status", "homes", "rooms", "accessories", "scenes", "automations", "zones", "events", "device-map", "control"],
            "socketPath": AppConfig.socketPath,
            "homeKitReady": isReady,
        ]
    }

    func listHomes() async -> [[String: Any]] {
        await waitUntilReady()
        return (manager?.homes ?? []).map { home in
            [
                "id": home.uniqueIdentifier.uuidString,
                "name": home.name,
                "primary": home.isPrimary,
            ]
        }
    }

    func listRooms(homeId: String?) async -> [[String: Any]] {
        await waitUntilReady()
        return targetHomes(homeId: homeId).flatMap { home in
            home.rooms.map { room in
                [
                    "id": room.uniqueIdentifier.uuidString,
                    "name": room.name,
                    "homeId": home.uniqueIdentifier.uuidString,
                    "homeName": home.name,
                    "accessoryCount": home.accessories.filter { $0.room?.uniqueIdentifier == room.uniqueIdentifier }.count,
                ]
            }
        }
    }

    func createRoom(name: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "room_create_rejected", payload: ["name": name])
        await waitUntilReady()
        let home = try targetHome(homeId: homeId)
        let auditId = AuditLog.record(action: "room_create_requested", payload: ["name": name, "homeName": home.name, "dryRun": dryRun])
        if dryRun { return mutationResult(auditId: auditId, dryRun: true, id: nil, name: name, home: home) }
        let room = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HMRoom, Error>) in
            home.addRoom(withName: name) { room, error in
                if let error { continuation.resume(throwing: error) }
                else if let room { continuation.resume(returning: room) }
                else { continuation.resume(throwing: BridgeRpcError(code: "ROOM_CREATE_FAILED", message: "HomeKit did not return a room")) }
            }
        }
        return mutationResult(auditId: auditId, dryRun: false, id: room.uniqueIdentifier.uuidString, name: room.name, home: home)
    }

    func renameRoom(roomId: String, newName: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "room_rename_rejected", payload: ["roomId": roomId, "newName": newName])
        await waitUntilReady()
        let found = try findRoomOrThrow(roomId, homeId: homeId)
        let oldName = found.room.name
        let auditId = AuditLog.record(action: "room_rename_requested", payload: ["roomId": found.room.uniqueIdentifier.uuidString, "oldName": oldName, "newName": newName, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.room.updateName(newName) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        var result = mutationResult(auditId: auditId, dryRun: dryRun, id: found.room.uniqueIdentifier.uuidString, name: newName, home: found.home)
        result["oldName"] = oldName
        result["newName"] = newName
        return result
    }

    func removeRoom(roomId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "room_remove_rejected", payload: ["roomId": roomId])
        await waitUntilReady()
        let found = try findRoomOrThrow(roomId, homeId: homeId)
        let auditId = AuditLog.record(action: "room_remove_requested", payload: ["roomId": found.room.uniqueIdentifier.uuidString, "name": found.room.name, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.home.removeRoom(found.room) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.room.uniqueIdentifier.uuidString, name: found.room.name, home: found.home)
    }

    func assignRoom(accessoryId: String, roomId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "room_assign_rejected", payload: ["accessoryId": accessoryId, "roomId": roomId])
        await waitUntilReady()
        let foundAccessory = try findAccessoryOrThrow(accessoryId, homeId: homeId)
        let foundRoom = try findRoomOrThrow(roomId, homeId: foundAccessory.home.uniqueIdentifier.uuidString)
        let auditId = AuditLog.record(action: "room_assign_requested", payload: ["accessoryId": foundAccessory.accessory.uniqueIdentifier.uuidString, "roomId": foundRoom.room.uniqueIdentifier.uuidString, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                foundAccessory.home.assignAccessory(foundAccessory.accessory, to: foundRoom.room) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        var result = mutationResult(auditId: auditId, dryRun: dryRun, id: foundAccessory.accessory.uniqueIdentifier.uuidString, name: foundAccessory.accessory.name, home: foundAccessory.home)
        result["roomId"] = foundRoom.room.uniqueIdentifier.uuidString
        result["roomName"] = foundRoom.room.name
        return result
    }

    func listAccessories(homeId: String?, room: String?, category: String?) async -> [[String: Any]] {
        await waitUntilReady()
        var result = targetHomes(homeId: homeId).flatMap { home in
            home.accessories.map { accessorySummary($0, home: home, includeServices: false) }
        }
        if let room, !room.isEmpty {
            result = result.filter { (($0["roomName"] as? String) ?? "").localizedCaseInsensitiveContains(room) }
        }
        if let category, !category.isEmpty {
            result = result.filter { (($0["category"] as? String) ?? "").localizedCaseInsensitiveContains(category) }
        }
        return result
    }

    func removeAccessory(accessoryId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "accessory_remove_rejected", payload: ["accessoryId": accessoryId])
        await waitUntilReady()
        let found = try findAccessoryOrThrow(accessoryId, homeId: homeId)
        let auditId = AuditLog.record(action: "accessory_remove_requested", payload: ["accessoryId": found.accessory.uniqueIdentifier.uuidString, "name": found.accessory.name, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.home.removeAccessory(found.accessory) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.accessory.uniqueIdentifier.uuidString, name: found.accessory.name, home: found.home)
    }

    func getAccessory(accessoryId: String, noRefresh: Bool) async throws -> [String: Any] {
        await waitUntilReady()
        guard let found = findAccessory(accessoryId) else {
            throw BridgeRpcError(code: "ACCESSORY_NOT_FOUND", message: "Accessory not found: \(accessoryId)")
        }
        if !noRefresh {
            for service in found.accessory.services {
                for characteristic in service.characteristics where !CharacteristicMapper.isWritable(characteristic) {
                    try? await readValue(characteristic)
                }
            }
        }
        return accessorySummary(found.accessory, home: found.home, includeServices: true)
    }

    func searchAccessories(query: String, category: String?) async -> [[String: Any]] {
        let all = await listAccessories(homeId: nil, room: nil, category: category)
        let normalized = query.lowercased()
        return all.filter { row in
            ["name", "roomName", "category", "manufacturer", "model"].contains { key in
                ((row[key] as? String) ?? "").lowercased().contains(normalized)
            }
        }
    }

    func listScenes(homeId: String?) async -> [[String: Any]] {
        await waitUntilReady()
        return targetHomes(homeId: homeId).flatMap { home in
            home.actionSets.map { scene in
                [
                    "id": scene.uniqueIdentifier.uuidString,
                    "name": scene.name,
                    "homeId": home.uniqueIdentifier.uuidString,
                    "homeName": home.name,
                    "actionCount": scene.actions.count,
                ]
            }
        }
    }

    func deleteScene(sceneId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "scene_delete_rejected", payload: ["sceneId": sceneId])
        await waitUntilReady()
        let found = try findSceneOrThrow(sceneId, homeId: homeId)
        let auditId = AuditLog.record(action: "scene_delete_requested", payload: ["sceneId": found.scene.uniqueIdentifier.uuidString, "name": found.scene.name, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.home.removeActionSet(found.scene) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.scene.uniqueIdentifier.uuidString, name: found.scene.name, home: found.home)
    }

    func getScene(sceneId: String) async throws -> [String: Any] {
        await waitUntilReady()
        for home in manager?.homes ?? [] {
            if let scene = home.actionSets.first(where: {
                $0.uniqueIdentifier.uuidString == sceneId || $0.name.caseInsensitiveCompare(sceneId) == .orderedSame
            }) {
                return [
                    "id": scene.uniqueIdentifier.uuidString,
                    "name": scene.name,
                    "homeId": home.uniqueIdentifier.uuidString,
                    "homeName": home.name,
                    "actions": scene.actions.map { action in
                        [
                            "type": String(describing: type(of: action)),
                        ]
                    },
                ]
            }
        }
        throw BridgeRpcError(code: "SCENE_NOT_FOUND", message: "Scene not found: \(sceneId)")
    }

    func deviceMap(homeId: String?) async -> [String: Any] {
        await waitUntilReady()
        let homes = targetHomes(homeId: homeId).map { home in
            [
                "id": home.uniqueIdentifier.uuidString,
                "name": home.name,
                "rooms": home.rooms.map { room in
                    [
                        "id": room.uniqueIdentifier.uuidString,
                        "name": room.name,
                        "accessories": home.accessories
                            .filter { $0.room?.uniqueIdentifier == room.uniqueIdentifier }
                            .map { accessorySummary($0, home: home, includeServices: false) },
                    ]
                },
            ]
        }
        return ["homes": homes]
    }

    func events(limit: Int, since: String?, type: String?) -> [[String: Any]] {
        EventStore.shared.list(limit: limit, since: since, type: type)
    }

    func listZones(homeId: String?) async -> [[String: Any]] {
        await waitUntilReady()
        return targetHomes(homeId: homeId).flatMap { home in
            home.zones.map { zoneSummary($0, home: home, includeRooms: false) }
        }
    }

    func createZone(name: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "zone_create_rejected", payload: ["name": name])
        await waitUntilReady()
        let home = try targetHome(homeId: homeId)
        let auditId = AuditLog.record(action: "zone_create_requested", payload: ["name": name, "homeName": home.name, "dryRun": dryRun])
        if dryRun { return mutationResult(auditId: auditId, dryRun: true, id: nil, name: name, home: home) }
        let zone = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HMZone, Error>) in
            home.addZone(withName: name) { zone, error in
                if let error { continuation.resume(throwing: error) }
                else if let zone { continuation.resume(returning: zone) }
                else { continuation.resume(throwing: BridgeRpcError(code: "ZONE_CREATE_FAILED", message: "HomeKit did not return a zone")) }
            }
        }
        return mutationResult(auditId: auditId, dryRun: false, id: zone.uniqueIdentifier.uuidString, name: zone.name, home: home)
    }

    func removeZone(zoneId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "zone_remove_rejected", payload: ["zoneId": zoneId])
        await waitUntilReady()
        let found = try findZoneOrThrow(zoneId, homeId: homeId)
        let auditId = AuditLog.record(action: "zone_remove_requested", payload: ["zoneId": found.zone.uniqueIdentifier.uuidString, "name": found.zone.name, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.home.removeZone(found.zone) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.zone.uniqueIdentifier.uuidString, name: found.zone.name, home: found.home)
    }

    func updateZoneRoom(zoneId: String, roomId: String, homeId: String?, adding: Bool, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: adding ? "zone_add_room_rejected" : "zone_remove_room_rejected", payload: ["zoneId": zoneId, "roomId": roomId])
        await waitUntilReady()
        let foundZone = try findZoneOrThrow(zoneId, homeId: homeId)
        let foundRoom = try findRoomOrThrow(roomId, homeId: foundZone.home.uniqueIdentifier.uuidString)
        let auditId = AuditLog.record(action: adding ? "zone_add_room_requested" : "zone_remove_room_requested", payload: ["zoneId": foundZone.zone.uniqueIdentifier.uuidString, "roomId": foundRoom.room.uniqueIdentifier.uuidString, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                let completion: (Error?) -> Void = { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
                if adding {
                    foundZone.zone.addRoom(foundRoom.room, completionHandler: completion)
                } else {
                    foundZone.zone.removeRoom(foundRoom.room, completionHandler: completion)
                }
            }
        }
        var result = mutationResult(auditId: auditId, dryRun: dryRun, id: foundZone.zone.uniqueIdentifier.uuidString, name: foundZone.zone.name, home: foundZone.home)
        result["roomId"] = foundRoom.room.uniqueIdentifier.uuidString
        result["roomName"] = foundRoom.room.name
        return result
    }

    func listAutomations(homeId: String?) async -> [[String: Any]] {
        await waitUntilReady()
        return targetHomes(homeId: homeId).flatMap { home in
            home.triggers.map { automationSummary($0, home: home) }
        }
    }

    func getAutomation(automationId: String, homeId: String?) async throws -> [String: Any] {
        await waitUntilReady()
        let found = try findTriggerOrThrow(automationId, homeId: homeId)
        var detail = automationSummary(found.trigger, home: found.home)
        detail["actionSets"] = found.trigger.actionSets.map { ["id": $0.uniqueIdentifier.uuidString, "name": $0.name, "actionCount": $0.actions.count] }
        detail["type"] = String(describing: type(of: found.trigger))
        if let eventTrigger = found.trigger as? HMEventTrigger {
            detail["eventCount"] = eventTrigger.events.count
            detail["predicate"] = eventTrigger.predicate.map { String(describing: $0) } as Any
        }
        return detail
    }

    func deleteAutomation(automationId: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "automation_delete_rejected", payload: ["automationId": automationId])
        await waitUntilReady()
        let found = try findTriggerOrThrow(automationId, homeId: homeId)
        let auditId = AuditLog.record(action: "automation_delete_requested", payload: ["automationId": found.trigger.uniqueIdentifier.uuidString, "name": found.trigger.name, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.home.removeTrigger(found.trigger) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.trigger.uniqueIdentifier.uuidString, name: found.trigger.name, home: found.home)
    }

    func setAutomationEnabled(automationId: String, homeId: String?, enabled: Bool, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "automation_enable_rejected", payload: ["automationId": automationId, "enabled": enabled])
        await waitUntilReady()
        let found = try findTriggerOrThrow(automationId, homeId: homeId)
        let auditId = AuditLog.record(action: "automation_enable_requested", payload: ["automationId": found.trigger.uniqueIdentifier.uuidString, "enabled": enabled, "dryRun": dryRun])
        if !dryRun {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                found.trigger.enable(enabled) { error in
                    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                }
            }
        }
        return mutationResult(auditId: auditId, dryRun: dryRun, id: found.trigger.uniqueIdentifier.uuidString, name: found.trigger.name, home: found.home)
    }

    func rewireAutomation(automationId: String, homeId: String?, addSceneIds: [String], removeSceneIds: [String], allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        try requireMutation(allowMutation, action: "automation_rewire_rejected", payload: ["automationId": automationId, "addSceneIds": addSceneIds, "removeSceneIds": removeSceneIds])
        await waitUntilReady()
        let found = try findTriggerOrThrow(automationId, homeId: homeId)
        let addScenes = try addSceneIds.map { try findSceneOrThrow($0, homeId: found.home.uniqueIdentifier.uuidString).scene }
        let removeScenes = try removeSceneIds.map { try findSceneOrThrow($0, homeId: found.home.uniqueIdentifier.uuidString).scene }
        let auditId = AuditLog.record(action: "automation_rewire_requested", payload: ["automationId": found.trigger.uniqueIdentifier.uuidString, "addSceneIds": addSceneIds, "removeSceneIds": removeSceneIds, "dryRun": dryRun])
        if !dryRun {
            for scene in addScenes {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    found.trigger.addActionSet(scene) { error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                    }
                }
            }
            for scene in removeScenes {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    found.trigger.removeActionSet(scene) { error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                    }
                }
            }
        }
        var result = mutationResult(auditId: auditId, dryRun: dryRun, id: found.trigger.uniqueIdentifier.uuidString, name: found.trigger.name, home: found.home)
        result["added"] = addScenes.count
        result["removed"] = removeScenes.count
        return result
    }

    func rename(kind: String, objectId: String, newName: String, homeId: String?, allowMutation: Bool, dryRun: Bool) async throws -> [String: Any] {
        switch kind {
        case "room":
            return try await renameRoom(roomId: objectId, newName: newName, homeId: homeId, allowMutation: allowMutation, dryRun: dryRun)
        case "accessory":
            try requireMutation(allowMutation, action: "accessory_rename_rejected", payload: ["id": objectId, "newName": newName])
            await waitUntilReady()
            let found = try findAccessoryOrThrow(objectId, homeId: homeId)
            let oldName = found.accessory.name
            let auditId = AuditLog.record(action: "accessory_rename_requested", payload: ["id": found.accessory.uniqueIdentifier.uuidString, "oldName": oldName, "newName": newName, "dryRun": dryRun])
            if !dryRun {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    found.accessory.updateName(newName) { error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                    }
                }
            }
            var result = mutationResult(auditId: auditId, dryRun: dryRun, id: found.accessory.uniqueIdentifier.uuidString, name: newName, home: found.home)
            result["oldName"] = oldName
            result["newName"] = newName
            return result
        case "scene":
            try requireMutation(allowMutation, action: "scene_rename_rejected", payload: ["id": objectId, "newName": newName])
            await waitUntilReady()
            let found = try findSceneOrThrow(objectId, homeId: homeId)
            let oldName = found.scene.name
            let auditId = AuditLog.record(action: "scene_rename_requested", payload: ["id": found.scene.uniqueIdentifier.uuidString, "oldName": oldName, "newName": newName, "dryRun": dryRun])
            if !dryRun {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    found.scene.updateName(newName) { error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                    }
                }
            }
            var result = mutationResult(auditId: auditId, dryRun: dryRun, id: found.scene.uniqueIdentifier.uuidString, name: newName, home: found.home)
            result["oldName"] = oldName
            result["newName"] = newName
            return result
        case "automation":
            try requireMutation(allowMutation, action: "automation_rename_rejected", payload: ["id": objectId, "newName": newName])
            await waitUntilReady()
            let found = try findTriggerOrThrow(objectId, homeId: homeId)
            let oldName = found.trigger.name
            let auditId = AuditLog.record(action: "automation_rename_requested", payload: ["id": found.trigger.uniqueIdentifier.uuidString, "oldName": oldName, "newName": newName, "dryRun": dryRun])
            if !dryRun {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    found.trigger.updateName(newName) { error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
                    }
                }
            }
            var result = mutationResult(auditId: auditId, dryRun: dryRun, id: found.trigger.uniqueIdentifier.uuidString, name: newName, home: found.home)
            result["oldName"] = oldName
            result["newName"] = newName
            return result
        default:
            throw BridgeRpcError(code: "UNSUPPORTED_RENAME_KIND", message: "Unsupported rename kind: \(kind)")
        }
    }

    func control(accessoryId: String, characteristic requestedCharacteristic: String, value rawValue: String, serviceType: String?, allowActuation: Bool) async throws -> [String: Any] {
        guard allowActuation else {
            let auditId = AuditLog.record(action: "control_rejected", payload: [
                "accessoryId": accessoryId,
                "characteristic": requestedCharacteristic,
                "reason": "missing_allow_actuation",
            ])
            throw BridgeRpcError(code: "ACTUATION_REQUIRES_CONFIRMATION", message: "Refusing control without allowActuation=true", details: ["auditId": auditId])
        }

        await waitUntilReady()
        guard let found = findAccessory(accessoryId) else {
            throw BridgeRpcError(code: "ACCESSORY_NOT_FOUND", message: "Accessory not found: \(accessoryId)")
        }

        let candidates = found.accessory.services
            .filter { serviceType == nil || $0.serviceType == serviceType }
            .flatMap { $0.characteristics }
            .filter { CharacteristicMapper.matches($0, requestedName: requestedCharacteristic) }
            .filter { CharacteristicMapper.isWritable($0) }

        guard candidates.count == 1, let characteristic = candidates.first else {
            throw BridgeRpcError(code: "CHARACTERISTIC_AMBIGUOUS_OR_NOT_FOUND", message: "Expected exactly one writable characteristic match; found \(candidates.count)")
        }

        let auditId = AuditLog.record(action: "control_requested", payload: [
            "accessoryId": found.accessory.uniqueIdentifier.uuidString,
            "accessoryName": found.accessory.name,
            "characteristic": CharacteristicMapper.displayName(for: characteristic.characteristicType),
            "value": rawValue,
        ])

        let value = CharacteristicMapper.parseValue(rawValue, for: characteristic)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            writeQueue.async {
                characteristic.writeValue(value) { error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume()
                    }
                }
            }
        }

        EventStore.shared.append(type: "accessory_controlled", message: "\(found.accessory.name).\(requestedCharacteristic) set", values: [
            "accessoryName": found.accessory.name,
            "characteristic": requestedCharacteristic,
            "value": rawValue,
            "auditId": auditId,
        ])

        return [
            "auditId": auditId,
            "accessoryId": found.accessory.uniqueIdentifier.uuidString,
            "characteristic": requestedCharacteristic,
            "accepted": true,
            "dryRun": false,
        ]
    }

    private func targetHomes(homeId: String?) -> [HMHome] {
        let homes = manager?.homes ?? []
        guard let homeId, !homeId.isEmpty else { return homes }
        return homes.filter { $0.uniqueIdentifier.uuidString == homeId || $0.name.caseInsensitiveCompare(homeId) == .orderedSame }
    }

    private func targetHome(homeId: String?) throws -> HMHome {
        let homes = targetHomes(homeId: homeId)
        guard homes.count == 1, let home = homes.first else {
            throw BridgeRpcError(code: "HOME_AMBIGUOUS_OR_NOT_FOUND", message: "Expected exactly one matching home; found \(homes.count)")
        }
        return home
    }

    private func findAccessory(_ accessoryId: String) -> (home: HMHome, accessory: HMAccessory)? {
        for home in manager?.homes ?? [] {
            if let accessory = home.accessories.first(where: {
                $0.uniqueIdentifier.uuidString == accessoryId || $0.name.caseInsensitiveCompare(accessoryId) == .orderedSame
            }) {
                return (home, accessory)
            }
        }
        return nil
    }

    private func findAccessoryOrThrow(_ accessoryId: String, homeId: String?) throws -> (home: HMHome, accessory: HMAccessory) {
        for home in targetHomes(homeId: homeId) {
            if let accessory = home.accessories.first(where: {
                $0.uniqueIdentifier.uuidString == accessoryId || $0.name.caseInsensitiveCompare(accessoryId) == .orderedSame
            }) {
                return (home, accessory)
            }
        }
        throw BridgeRpcError(code: "ACCESSORY_NOT_FOUND", message: "Accessory not found: \(accessoryId)")
    }

    private func findRoomOrThrow(_ roomId: String, homeId: String?) throws -> (home: HMHome, room: HMRoom) {
        for home in targetHomes(homeId: homeId) {
            if let room = home.rooms.first(where: {
                $0.uniqueIdentifier.uuidString == roomId || $0.name.caseInsensitiveCompare(roomId) == .orderedSame
            }) {
                return (home, room)
            }
        }
        throw BridgeRpcError(code: "ROOM_NOT_FOUND", message: "Room not found: \(roomId)")
    }

    private func findZoneOrThrow(_ zoneId: String, homeId: String?) throws -> (home: HMHome, zone: HMZone) {
        for home in targetHomes(homeId: homeId) {
            if let zone = home.zones.first(where: {
                $0.uniqueIdentifier.uuidString == zoneId || $0.name.caseInsensitiveCompare(zoneId) == .orderedSame
            }) {
                return (home, zone)
            }
        }
        throw BridgeRpcError(code: "ZONE_NOT_FOUND", message: "Zone not found: \(zoneId)")
    }

    private func findSceneOrThrow(_ sceneId: String, homeId: String?) throws -> (home: HMHome, scene: HMActionSet) {
        for home in targetHomes(homeId: homeId) {
            if let scene = home.actionSets.first(where: {
                $0.uniqueIdentifier.uuidString == sceneId || $0.name.caseInsensitiveCompare(sceneId) == .orderedSame
            }) {
                return (home, scene)
            }
        }
        throw BridgeRpcError(code: "SCENE_NOT_FOUND", message: "Scene not found: \(sceneId)")
    }

    private func findTriggerOrThrow(_ triggerId: String, homeId: String?) throws -> (home: HMHome, trigger: HMTrigger) {
        for home in targetHomes(homeId: homeId) {
            if let trigger = home.triggers.first(where: {
                $0.uniqueIdentifier.uuidString == triggerId || $0.name.caseInsensitiveCompare(triggerId) == .orderedSame
            }) {
                return (home, trigger)
            }
        }
        throw BridgeRpcError(code: "AUTOMATION_NOT_FOUND", message: "Automation not found: \(triggerId)")
    }

    private func requireMutation(_ allowed: Bool, action: String, payload: [String: Any]) throws {
        guard allowed else {
            let auditId = AuditLog.record(action: action, payload: payload.merging(["reason": "missing_allow_mutation"]) { current, _ in current })
            throw BridgeRpcError(code: "MUTATION_REQUIRES_CONFIRMATION", message: "Refusing mutation without allowMutation=true", details: ["auditId": auditId])
        }
    }

    private func mutationResult(auditId: String, dryRun: Bool, id: String?, name: String?, home: HMHome) -> [String: Any] {
        [
            "auditId": auditId,
            "accepted": !dryRun,
            "dryRun": dryRun,
            "id": id as Any,
            "name": name as Any,
            "homeId": home.uniqueIdentifier.uuidString,
            "homeName": home.name,
        ]
    }

    private func accessorySummary(_ accessory: HMAccessory, home: HMHome, includeServices: Bool) -> [String: Any] {
        var row: [String: Any] = [
            "id": accessory.uniqueIdentifier.uuidString,
            "name": accessory.name,
            "homeId": home.uniqueIdentifier.uuidString,
            "homeName": home.name,
            "roomId": accessory.room?.uniqueIdentifier.uuidString as Any,
            "roomName": accessory.room?.name as Any,
            "category": accessory.category.categoryType,
            "manufacturer": accessory.manufacturer ?? "",
            "model": accessory.model ?? "",
            "serialNumber": "",
            "firmwareVersion": accessory.firmwareVersion ?? "",
            "reachable": accessory.isReachable,
        ]
        if includeServices {
            row["services"] = accessory.services.map { service in
                [
                    "id": service.uniqueIdentifier.uuidString,
                    "type": service.serviceType,
                    "name": service.name,
                    "characteristics": service.characteristics.map { characteristic in
                        [
                            "id": characteristic.uniqueIdentifier.uuidString,
                            "type": characteristic.characteristicType,
                            "name": CharacteristicMapper.displayName(for: characteristic.characteristicType),
                            "value": characteristic.value ?? NSNull(),
                            "writable": CharacteristicMapper.isWritable(characteristic),
                        ]
                    },
                ]
            }
        }
        return row
    }

    private func zoneSummary(_ zone: HMZone, home: HMHome, includeRooms: Bool) -> [String: Any] {
        var row: [String: Any] = [
            "id": zone.uniqueIdentifier.uuidString,
            "name": zone.name,
            "homeId": home.uniqueIdentifier.uuidString,
            "homeName": home.name,
            "roomCount": zone.rooms.count,
        ]
        if includeRooms {
            row["rooms"] = zone.rooms.map { room in
                [
                    "id": room.uniqueIdentifier.uuidString,
                    "name": room.name,
                    "homeId": home.uniqueIdentifier.uuidString,
                    "homeName": home.name,
                    "accessoryCount": home.accessories.filter { $0.room?.uniqueIdentifier == room.uniqueIdentifier }.count,
                ]
            }
        }
        return row
    }

    private func automationSummary(_ trigger: HMTrigger, home: HMHome) -> [String: Any] {
        var row: [String: Any] = [
            "id": trigger.uniqueIdentifier.uuidString,
            "name": trigger.name,
            "homeId": home.uniqueIdentifier.uuidString,
            "homeName": home.name,
            "enabled": trigger.isEnabled,
            "actionSetCount": trigger.actionSets.count,
            "scenes": trigger.actionSets.map(\.name),
            "eventSummary": String(describing: type(of: trigger)),
        ]
        if let eventTrigger = trigger as? HMEventTrigger {
            row["eventCount"] = eventTrigger.events.count
        } else {
            row["eventCount"] = 0
        }
        return row
    }

    private func refreshCache() {
        let homes = manager?.homes ?? []
        let rows = homes.flatMap { home in
            home.accessories.map { accessorySummary($0, home: home, includeServices: false) }
        }
        cacheLock.lock()
        cachedAccessories = rows
        cacheUpdatedAt = Date()
        cacheLock.unlock()
    }

    private func readValue(_ characteristic: HMCharacteristic) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            characteristic.readValue { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    private func cacheSnapshot() -> (count: Int, updatedAt: String?) {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        return (
            cachedAccessories.count,
            cacheUpdatedAt.map { ISO8601DateFormatter().string(from: $0) }
        )
    }
}

struct BridgeRpcError: Error, @unchecked Sendable {
    let code: String
    let message: String
    var details: Any? = nil
}
