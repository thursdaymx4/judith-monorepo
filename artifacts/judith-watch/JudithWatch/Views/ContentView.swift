import SwiftUI

// MARK: — Root view: gates on auth, then shows the Up Next list

struct ContentView: View {
    @EnvironmentObject var store: BillStore
    @EnvironmentObject var connectivity: ConnectivityService

    var body: some View {
        Group {
            if store.token == nil {
                AuthView()
            } else {
                UpNextView()
            }
        }
        .background(Color.black)
        // When ConnectivityService receives a token from the phone, propagate it
        .onChange(of: connectivity.receivedToken) { _, newToken in
            if let t = newToken { store.applyToken(t) }
        }
    }
}
