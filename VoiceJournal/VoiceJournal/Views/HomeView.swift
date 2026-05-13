import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \JournalEntry.date, order: .reverse) private var entries: [JournalEntry]

    @State private var showingSession = false
    @State private var showingSettings = false
    @State private var selectedEntry: JournalEntry?

    private var hasJournaledToday: Bool {
        entries.contains { Calendar.current.isDateInToday($0.date) }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    headerSection
                    journalButtonSection
                    if !entries.isEmpty {
                        recentEntriesSection
                    } else {
                        emptyStateSection
                    }
                }
                .padding()
            }
            .navigationTitle("My Journal")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showingSession) {
            JournalSessionView { entry in
                modelContext.insert(entry)
            }
        }
        .sheet(item: $selectedEntry) { entry in
            JournalDetailView(entry: entry)
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
        }
    }

    // MARK: - Sections

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var journalButtonSection: some View {
        Group {
            if hasJournaledToday {
                HStack(spacing: 14) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.green)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Journaled today")
                            .font(.headline)
                        Text("Come back tomorrow for your next reflection")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding()
                .background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
            } else {
                Button {
                    showingSession = true
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "mic.fill")
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Start Today's Journal")
                                .font(.headline)
                            Text("Wings, Highs & Lows")
                                .font(.subheadline)
                                .opacity(0.85)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                    }
                    .padding()
                    .foregroundStyle(.white)
                    .background(.indigo, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
    }

    private var recentEntriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Entries")
                .font(.headline)
            ForEach(entries.prefix(20)) { entry in
                Button {
                    selectedEntry = entry
                } label: {
                    EntryRowView(entry: entry)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var emptyStateSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text("No entries yet")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Start your first journal session above")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 32)
    }
}

// MARK: - Entry Row

struct EntryRowView: View {
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.shortDate)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            if !entry.wings.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Text("Wings")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(.indigo)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.indigo.opacity(0.12), in: Capsule())
                    Text(entry.wings)
                        .font(.subheadline)
                        .lineLimit(2)
                        .foregroundStyle(.primary)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}
