import Foundation
import HomeKit

enum CharacteristicMapper {
    static func displayName(for type: String) -> String {
        switch type {
        case HMCharacteristicTypePowerState: "power"
        case HMCharacteristicTypeBrightness: "brightness"
        case HMCharacteristicTypeTargetDoorState: "target_door_state"
        case HMCharacteristicTypeCurrentDoorState: "current_door_state"
        case "0000001D-0000-1000-8000-0026BB765291": "lock_current_state"
        case "0000001E-0000-1000-8000-0026BB765291": "lock_target_state"
        case HMCharacteristicTypeTargetPosition: "target_position"
        case HMCharacteristicTypeCurrentPosition: "current_position"
        case HMCharacteristicTypeMotionDetected: "motion_detected"
        case HMCharacteristicTypeContactState: "contact_state"
        case HMCharacteristicTypeOccupancyDetected: "occupancy_detected"
        case HMCharacteristicTypeCurrentTemperature: "current_temperature"
        case HMCharacteristicTypeTargetTemperature: "target_temperature"
        case HMCharacteristicTypeName: "name"
        case HMCharacteristicTypeManufacturer: "manufacturer"
        case HMCharacteristicTypeModel: "model"
        case HMCharacteristicTypeSerialNumber: "serial_number"
        case HMCharacteristicTypeFirmwareVersion: "firmware_version"
        default: type.components(separatedBy: ".").last ?? type
        }
    }

    static func matches(_ characteristic: HMCharacteristic, requestedName: String) -> Bool {
        let normalized = requestedName.lowercased()
        return characteristic.characteristicType.lowercased() == normalized
            || displayName(for: characteristic.characteristicType).lowercased() == normalized
    }

    static func parseValue(_ raw: String, for characteristic: HMCharacteristic) -> Any {
        if characteristic.properties.contains(HMCharacteristicPropertySupportsEventNotification) {
            // no-op: keeps the property reference useful for compiler availability.
        }
        if raw.caseInsensitiveCompare("true") == .orderedSame { return true }
        if raw.caseInsensitiveCompare("false") == .orderedSame { return false }
        if let intValue = Int(raw) { return intValue }
        if let doubleValue = Double(raw) { return doubleValue }
        return raw
    }

    static func isWritable(_ characteristic: HMCharacteristic) -> Bool {
        characteristic.properties.contains(HMCharacteristicPropertyWritable)
    }
}
