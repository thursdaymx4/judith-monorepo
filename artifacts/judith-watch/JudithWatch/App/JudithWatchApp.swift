import SwiftUI
import UserNotifications

@main
struct JudithWatchApp: App {

    @StateObject private var store = BillStore()
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
                    Task { await store.refresh() }
                }
        }

        // Long-look notification scene
        WKNotificationScene(controller: NotificationController.self,
                            category: "BILL_DUE")
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge, .criticalAlert]
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
        let remindTomorrow = UNNotificationAction(
            identifier: "REMIND_TOMORROW",
            title: "Remind tomorrow",
            options: []
        )
        let category = UNNotificationCategory(
            identifier: "BILL_DUE",
            actions: [markPaid, remindTomorrow],
            intentIdentifiers: [],
            options: [.allowAnnouncement]
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }
}
