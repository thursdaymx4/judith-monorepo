import SwiftUI
import UserNotifications

// NOTE: @main is here on the App struct. JudithComplicationBundle (WidgetBundle)
// has no @main — watchOS 9+ auto-discovers Widget types in the same target as
// complications without needing the bundle to be the module entry point.
@main
struct JudithWatchApp: App {

    @StateObject private var store        = WatchStore()
    @StateObject private var connectivity = ConnectivityService.shared

    init() {
        requestNotificationPermission()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(connectivity)
                .onAppear {
                    ConnectivityService.shared.register(store: store)
                }
        }

        WKNotificationScene(controller: NotificationController.self,
                            category: "BILL_DUE")
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { _, _ in
            registerNotificationCategories()
        }
    }

    private func registerNotificationCategories() {
        let markPaid = UNNotificationAction(
            identifier: "MARK_PAID",
            title: "Mark paid",
            options: [.foreground]
        )
        let category = UNNotificationCategory(
            identifier: "BILL_DUE",
            actions: [markPaid],
            intentIdentifiers: [],
            options: [.allowAnnouncement]
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }
}
