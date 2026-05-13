import Foundation
import SwiftData

@Model
final class JournalEntry {
    var id: UUID
    var date: Date
    var wings: String
    var highs: String
    var lows: String
    var rawTranscript: String
    var createdAt: Date

    init(
        date: Date = Date(),
        wings: String = "",
        highs: String = "",
        lows: String = "",
        rawTranscript: String = ""
    ) {
        self.id = UUID()
        self.date = date
        self.wings = wings
        self.highs = highs
        self.lows = lows
        self.rawTranscript = rawTranscript
        self.createdAt = Date()
    }

    var formattedDate: String {
        Date.FormatStyle().weekday(.wide).month(.wide).day().year().format(date)
    }

    var shortDate: String {
        date.formatted(.dateTime.month(.abbreviated).day().year())
    }
}
