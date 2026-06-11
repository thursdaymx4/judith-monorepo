import SwiftUI

// MARK: — Root view: gates on payload availability, then shows tab pages
// Tab order: Face (paid ring + summary) → Bills → Ask Judith

struct ContentView: View {
    @EnvironmentObject var store: WatchStore
    @EnvironmentObject var connectivity: ConnectivityService

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
    }

    private var shouldShowMainUI: Bool {
        store.isReady || connectivity.isPhoneReachable
    }
}
