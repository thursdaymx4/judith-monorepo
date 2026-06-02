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

// MARK: — Smart Stack widget (rises in stack as due date approaches)

struct JudithSmartStack: Widget {
    static let kind = "JudithSmartStack"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: JudithProvider()) { entry in
            SmartStackView(entry: entry)
        }
        .configurationDisplayName("Judith — Bill Due")
        .description("Surfaces your most urgent unpaid bill in the Smart Stack.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: — Bundle

@main
struct JudithWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        JudithComplication()
        JudithSmartStack()
    }
}
