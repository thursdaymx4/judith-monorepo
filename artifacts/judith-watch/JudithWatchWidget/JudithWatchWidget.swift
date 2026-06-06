import WidgetKit
import SwiftUI

// MARK: — Watch face complications (all accessor families)

struct JudithComplication: Widget {
    static let kind = "JudithComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: JudithProvider()) { entry in
            ComplicationViews(entry: entry)
                .containerBackground(Color.black, for: .widget)
        }
        .configurationDisplayName("Judith")
        .description("Your next bill at a glance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: — Bundle

@main
struct JudithWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        JudithComplication()
    }
}
