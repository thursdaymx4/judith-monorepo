import SwiftUI
import UserNotifications

// NOTE: @main lives in JudithComplicationBundle.swift so the WidgetBundle
// can be the module entry point (watchOS 9+). The App struct is still found
// by the runtime because it conforms to the App protocol in the same target.
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
