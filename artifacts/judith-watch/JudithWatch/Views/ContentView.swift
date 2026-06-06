import SwiftUI

// MARK: — Root view: gates on payload availability, then shows tab pages

struct ContentView: View {
    @EnvironmentObject var store:        WatchStore
    @EnvironmentObject var connectivity: ConnectivityService

    var body: some View {
        Group {
            if store.isReady {
                TabView {
                    UpNextView()
                    AskView()
                }
                .tabViewStyle(.page)
            } else {
                AuthView()
            }
        }
        .background(Color.black)
    }
}
