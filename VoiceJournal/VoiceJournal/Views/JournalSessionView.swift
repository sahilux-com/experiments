import SwiftUI

struct JournalSessionView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: JournalSessionViewModel

    let onSave: (JournalEntry) -> Void

    init(onSave: @escaping (JournalEntry) -> Void) {
        self.onSave = onSave
        let key = UserDefaults.standard.string(forKey: "openai_api_key") ?? ""
        _viewModel = StateObject(wrappedValue: JournalSessionViewModel(apiKey: key))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                phaseProgressBar
                conversationArea
                Divider()
                bottomBar
            }
            .background(Color(.systemBackground))
            .navigationTitle(viewModel.phase.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Dismiss") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    nextButton
                }
            }
        }
        .task {
            await viewModel.speechService.requestPermissions()
            await viewModel.startSession()
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    // MARK: - Phase progress bar

    private var phaseProgressBar: some View {
        HStack(spacing: 0) {
            ForEach(Array([JournalPhase.wings, .highs, .lows].enumerated()), id: \.offset) { index, p in
                HStack(spacing: 0) {
                    VStack(spacing: 4) {
                        Circle()
                            .fill(phaseColor(p))
                            .frame(width: 10, height: 10)
                        Text(p.label)
                            .font(.caption2)
                            .foregroundStyle(viewModel.phase == p ? .indigo : .secondary)
                    }
                    if index < 2 {
                        Rectangle()
                            .fill(phaseIndex(viewModel.phase) > index ? Color.indigo.opacity(0.5) : Color(.tertiarySystemFill))
                            .frame(height: 2)
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, 14)
                    }
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
    }

    private func phaseColor(_ p: JournalPhase) -> Color {
        let idx = phaseIndex(p)
        let current = phaseIndex(viewModel.phase)
        if idx < current { return .green }
        if idx == current { return .indigo }
        return Color(.tertiarySystemFill)
    }

    private func phaseIndex(_ p: JournalPhase) -> Int {
        switch p {
        case .wings: return 0
        case .highs: return 1
        case .lows: return 2
        case .done: return 3
        }
    }

    // MARK: - Conversation area

    private var conversationArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.visibleMessages) { msg in
                        MessageBubble(message: msg)
                            .id(msg.id)
                    }

                    if viewModel.state == .processing || viewModel.state == .loading {
                        TypingIndicator()
                            .id("typing")
                    }

                    if !viewModel.liveTranscript.isEmpty {
                        LiveTranscriptBubble(text: viewModel.liveTranscript)
                            .id("live")
                    }

                    if let summary = viewModel.summary, viewModel.state == .complete {
                        SummaryCard(summary: summary)
                            .id("summary")
                            .padding(.top, 8)
                    }

                    Color.clear.frame(height: 8).id("bottom")
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
            }
            .onChange(of: viewModel.messages.count) { _, _ in
                withAnimation { proxy.scrollTo("bottom") }
            }
            .onChange(of: viewModel.state) { _, _ in
                withAnimation { proxy.scrollTo("bottom") }
            }
            .onChange(of: viewModel.liveTranscript) { _, _ in
                proxy.scrollTo("live")
            }
        }
    }

    // MARK: - Bottom bar

    private var bottomBar: some View {
        VStack(spacing: 12) {
            if viewModel.state == .complete, let summary = viewModel.summary {
                Button {
                    let entry = JournalEntry(
                        date: Date(),
                        wings: summary.wings,
                        highs: summary.highs,
                        lows: summary.lows,
                        rawTranscript: viewModel.conversationTranscript
                    )
                    onSave(entry)
                    dismiss()
                } label: {
                    Label("Save Journal Entry", systemImage: "square.and.arrow.down")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(.green, in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal)
            } else {
                recordButton
                if viewModel.state == .idle || viewModel.state == .recording {
                    Text(viewModel.state == .recording ? "Tap to stop" : "Tap to speak")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.top, 12)
        .padding(.bottom, 28)
    }

    private var recordButton: some View {
        let isRec = viewModel.state == .recording
        let disabled = viewModel.state == .processing || viewModel.state == .loading

        return Button {
            if isRec {
                Task { await viewModel.stopRecordingAndSend() }
            } else if !disabled {
                Task { await viewModel.startRecording() }
            }
        } label: {
            ZStack {
                Circle()
                    .fill(isRec ? Color.red : Color.indigo)
                    .frame(width: 72, height: 72)
                    .shadow(
                        color: (isRec ? Color.red : Color.indigo).opacity(0.35),
                        radius: isRec ? 16 : 8
                    )

                Image(systemName: isRec ? "stop.fill" : "mic.fill")
                    .font(.title)
                    .foregroundStyle(.white)
            }
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1.0)
        .scaleEffect(isRec ? 1.12 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isRec)
    }

    // MARK: - Toolbar next/summarize button

    @ViewBuilder
    private var nextButton: some View {
        if viewModel.state == .idle && viewModel.phase != .done && viewModel.phase != .lows {
            Button("Next") { viewModel.advancePhase() }
        } else if viewModel.state == .idle && viewModel.phase == .lows {
            Button("Summarize") {
                Task { await viewModel.generateSummary() }
            }
            .fontWeight(.semibold)
        }
    }
}

// MARK: - Sub-views

struct MessageBubble: View {
    let message: ConversationMessage

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }
            Text(message.content)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    isUser ? Color.indigo : Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 18)
                )
                .foregroundStyle(isUser ? .white : .primary)
            if !isUser { Spacer(minLength: 48) }
        }
    }
}

struct LiveTranscriptBubble: View {
    let text: String

    var body: some View {
        HStack {
            Spacer(minLength: 48)
            Text(text)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.indigo.opacity(0.25), in: RoundedRectangle(cornerRadius: 18))
                .foregroundStyle(.primary)
                .overlay(alignment: .topTrailing) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .padding(6)
                }
        }
    }
}

struct TypingIndicator: View {
    @State private var phase = false

    var body: some View {
        HStack {
            HStack(spacing: 5) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(Color.secondary.opacity(0.6))
                        .frame(width: 8, height: 8)
                        .scaleEffect(phase ? 1.2 : 0.7)
                        .animation(
                            .easeInOut(duration: 0.45)
                                .repeatForever()
                                .delay(Double(i) * 0.15),
                            value: phase
                        )
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
            Spacer()
        }
        .onAppear { phase = true }
    }
}

struct SummaryCard: View {
    let summary: JournalSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Your Journal Entry")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .center)

            SummarySectionRow(title: "Wings", content: summary.wings, color: .indigo)
            SummarySectionRow(title: "Highs", content: summary.highs, color: .green)
            SummarySectionRow(title: "Lows", content: summary.lows, color: .orange)
        }
        .padding()
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct SummarySectionRow: View {
    let title: String
    let content: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(color)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(color.opacity(0.12), in: Capsule())
            Text(content.isEmpty ? "Nothing to note" : content)
                .font(.subheadline)
                .foregroundStyle(content.isEmpty ? .tertiary : .primary)
                .italic(content.isEmpty)
        }
    }
}
