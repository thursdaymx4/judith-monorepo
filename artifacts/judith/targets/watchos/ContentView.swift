import SwiftUI

// MARK: — Root view: gates on payload availability, then shows tab pages
// Tab order: Face (paid ring + summary) → Bills → Ask Judith

struct ContentView: View {
    @EnvironmentObject var store: WatchStore
    @EnvironmentObject var connectivity: ConnectivityService
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var launchFlags = JudithLaunchFlags.shared

    // Bound selection so child views can restore focus after a WatchKit
    // modal (e.g. presentTextInputController in AskView) dismisses. Without
    // an explicit binding, watchOS sometimes lands the user on a different
    // page when control returns to SwiftUI from a WatchKit interop call —
    // the user typed a question, then the "Judith is thinking…" screen
    // wasn't visible because the TabView had quietly switched pages.
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if shouldShowMainUI {
                TabView(selection: $selectedTab) {
                    FaceView().tag(0)
                    UpNextView().tag(1)
                    AskView(selectedTab: $selectedTab, tagValue: 2).tag(2)
                }
                .tabViewStyle(.page)
            } else {
                AuthView()
            }
        }
        .background(Color.black)
        // Action Button binding: when the OpenJudithAskWatchIntent ran (either
        // headlessly via the Action Button before the app reached foreground,
        // or via voice) JudithLaunchFlags.shouldOpenAsk flips to true.
        // We respond by snapping to the Ask tab and acknowledging.
        .onChange(of: launchFlags.shouldOpenAsk) { _, shouldOpen in
            if shouldOpen {
                selectedTab = 2
                launchFlags.acknowledge()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Re-check the App Group flag whenever we come back to the
            // foreground — covers the Action Button press while the app
            // was in the background.
            if phase == .active {
                launchFlags.refresh()
                connectivity.requestPayloadRefresh()
            }
        }
        .task {
            // Cover cold-start: refresh once after the view tree is mounted.
            launchFlags.refresh()
            connectivity.requestPayloadRefresh()
        }
    }

    private var shouldShowMainUI: Bool {
        store.isReady || connectivity.isPhoneReachable
    }
}
