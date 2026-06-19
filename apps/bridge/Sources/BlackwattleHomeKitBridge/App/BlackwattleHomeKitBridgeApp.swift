import Foundation
import UIKit

@main
final class BlackwattleHomeKitBridgeApp: UIResponder, UIApplicationDelegate {
    private var appNapActivity: NSObjectProtocol?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        AppLogger.app.info("HomeKit Bridge starting")
        appNapActivity = ProcessInfo.processInfo.beginActivity(
            options: .userInitiatedAllowingIdleSystemSleep,
            reason: "HomeKit bridge socket server")

        #if targetEnvironment(macCatalyst)
        setAccessoryActivationPolicy()
        #endif

        SocketServer.shared.start()
        return true
    }

    func applicationWillTerminate(_ application: UIApplication) {
        AppLogger.app.info("HomeKit Bridge shutting down")
        SocketServer.shared.stop()
        if let appNapActivity {
            ProcessInfo.processInfo.endActivity(appNapActivity)
            self.appNapActivity = nil
        }
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Headless", sessionRole: connectingSceneSession.role)
        configuration.delegateClass = HeadlessSceneDelegate.self
        return configuration
    }

    #if targetEnvironment(macCatalyst)
    private func setAccessoryActivationPolicy() {
        guard let nsAppClass: AnyClass = NSClassFromString("NSApplication") else { return }
        let sharedAppSelector = NSSelectorFromString("sharedApplication")
        guard let metaclass = object_getClass(nsAppClass),
              let sharedAppIMP = class_getMethodImplementation(metaclass, sharedAppSelector)
        else { return }

        typealias SharedAppFn = @convention(c) (AnyObject, Selector) -> NSObject
        let sharedApp = unsafeBitCast(sharedAppIMP, to: SharedAppFn.self)(nsAppClass, sharedAppSelector)
        let setPolicySelector = NSSelectorFromString("setActivationPolicy:")
        guard sharedApp.responds(to: setPolicySelector) else { return }
        typealias SetPolicyFn = @convention(c) (NSObject, Selector, Int) -> Bool
        let setPolicy = unsafeBitCast(sharedApp.method(for: setPolicySelector), to: SetPolicyFn.self)
        _ = setPolicy(sharedApp, setPolicySelector, 1)
    }
    #endif
}

final class HeadlessSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        window = nil

        #if targetEnvironment(macCatalyst)
        if let windowScene = scene as? UIWindowScene {
            windowScene.sizeRestrictions?.minimumSize = CGSize(width: 1, height: 1)
            windowScene.sizeRestrictions?.maximumSize = CGSize(width: 1, height: 1)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            Self.hideAllNSWindows()
        }
        #endif

        HomeKitManager.shared.start()
    }

    #if targetEnvironment(macCatalyst)
    private static func hideAllNSWindows() {
        guard let nsAppClass: AnyClass = NSClassFromString("NSApplication"),
              let metaclass = object_getClass(nsAppClass),
              let imp = class_getMethodImplementation(metaclass, NSSelectorFromString("sharedApplication"))
        else { return }

        typealias SharedAppFn = @convention(c) (AnyObject, Selector) -> NSObject
        let sharedApp = unsafeBitCast(imp, to: SharedAppFn.self)(nsAppClass, NSSelectorFromString("sharedApplication"))
        guard let windows = sharedApp.value(forKey: "windows") as? [NSObject] else { return }
        for nsWindow in windows {
            let selector = NSSelectorFromString("orderOut:")
            if nsWindow.responds(to: selector) {
                typealias OrderOutFn = @convention(c) (NSObject, Selector, NSObject?) -> Void
                let orderOut = unsafeBitCast(nsWindow.method(for: selector), to: OrderOutFn.self)
                orderOut(nsWindow, selector, nil)
            }
        }
    }
    #endif
}
