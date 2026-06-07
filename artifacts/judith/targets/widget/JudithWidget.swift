import WidgetKit
import SwiftUI

// MARK: — Homescreen widget (Small / Medium / Large)

struct JudithHomeWidget: Widget {
    static let kind = "JudithHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: JudithProvider()) { entry in
            JudithWidgetView(entry: entry)
                .containerBackground(Color.bgBase, for: .widget)
        }
        .configurationDisplayName("Judith")
        .description("Your bills at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: — Lockscreen / StandBy widget (iOS 16+)

struct JudithLockWidget: Widget {
    static let kind = "JudithLockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: JudithProvider()) { entry in
            JudithWidgetView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Judith")
        .description("Next bill at a glance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: — Bundle

@main
struct JudithWidgetBundle: WidgetBundle {
    var body: some Widget {
        JudithHomeWidget()
        JudithLockWidget()
    }
}
