import SwiftUI

struct JournalDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    let entry: JournalEntry
    @State private var showDeleteConfirm = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(entry.formattedDate)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)

                    JournalSection(
                        title: "Wings",
                        subtitle: "What lifted your spirit",
                        content: entry.wings,
                        color: .indigo
                    )

                    JournalSection(
                        title: "Highs",
                        subtitle: "Best moments of the day",
                        content: entry.highs,
                        color: .green
                    )

                    JournalSection(
                        title: "Lows",
                        subtitle: "Challenges faced today",
                        content: entry.lows,
                        color: .orange
                    )
                }
                .padding()
            }
            .navigationTitle(entry.shortDate)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showDeleteConfirm = true
                    } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(.red)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Delete this journal entry?",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    modelContext.delete(entry)
                    dismiss()
                }
            }
        }
    }
}

struct JournalSection: View {
    let title: String
    let subtitle: String
    let content: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(color)
                    .frame(width: 4, height: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(content.isEmpty ? "Nothing recorded" : content)
                .font(.body)
                .lineSpacing(4)
                .foregroundStyle(content.isEmpty ? .tertiary : .primary)
                .italic(content.isEmpty)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}
