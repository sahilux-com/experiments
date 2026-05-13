import Foundation
import Combine

enum SessionState: Equatable {
    case loading
    case idle
    case recording
    case processing
    case complete
}

enum JournalPhase: CaseIterable, Hashable {
    case wings, highs, lows, done

    var label: String {
        switch self {
        case .wings: return "Wings"
        case .highs: return "Highs"
        case .lows: return "Lows"
        case .done: return "Summary"
        }
    }

    var guidePrompt: String {
        switch self {
        case .wings: return "Now let's talk about your Highs — what were the best moments of your day?"
        case .highs: return "Let's move to your Lows — what challenges or difficulties did you face today?"
        case .lows, .done: return ""
        }
    }
}

private let systemPrompt = """
You are a warm, empathetic personal journal guide helping someone reflect on their day through \
the "Wings, Highs & Lows" framework:
- Wings: What gave them energy, lifted their spirit, or what they're proud of
- Highs: The best moments, wins, or positive experiences of the day
- Lows: Challenges, difficulties, or disappointments faced today

Guidelines:
- Keep every response to 1–2 sentences max
- Be warm, curious, and supportive — never lecture
- Ask open-ended follow-up questions to draw out reflection
- Never write bullet points or lists — speak conversationally

Start by warmly welcoming the person and asking about their Wings for today.
"""

@MainActor
final class JournalSessionViewModel: ObservableObject {
    @Published var messages: [ConversationMessage] = []
    @Published var phase: JournalPhase = .wings
    @Published var state: SessionState = .loading
    @Published var liveTranscript: String = ""
    @Published var summary: JournalSummary?
    @Published var errorMessage: String?

    let speechService: SpeechService
    private let openAIService: OpenAIService
    private var cancellables = Set<AnyCancellable>()

    init(apiKey: String) {
        self.speechService = SpeechService()
        self.openAIService = OpenAIService(apiKey: apiKey)

        speechService.$transcribedText
            .receive(on: RunLoop.main)
            .assign(to: \.liveTranscript, on: self)
            .store(in: &cancellables)

        // Auto-send when speech recognizer ends due to silence
        speechService.$isRecording
            .dropFirst()
            .receive(on: RunLoop.main)
            .sink { [weak self] isRec in
                guard let self, !isRec, self.state == .recording else { return }
                Task { await self.stopRecordingAndSend() }
            }
            .store(in: &cancellables)
    }

    var visibleMessages: [ConversationMessage] {
        messages.filter { $0.role != .system }
    }

    var conversationTranscript: String {
        visibleMessages
            .map { msg in
                let label = msg.role == .user ? "Me" : "Guide"
                return "\(label): \(msg.content)"
            }
            .joined(separator: "\n\n")
    }

    // MARK: - Session lifecycle

    func startSession() async {
        messages = [ConversationMessage(role: .system, content: systemPrompt)]
        state = .loading
        await sendToAI()
    }

    func startRecording() async {
        do {
            try speechService.startRecording()
            state = .recording
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stopRecordingAndSend() async {
        guard state == .recording else { return }
        state = .processing
        let transcript = speechService.stopRecording()
        liveTranscript = ""

        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            state = .idle
            return
        }

        messages.append(ConversationMessage(role: .user, content: trimmed))
        await sendToAI()
    }

    func advancePhase() {
        guard let next = nextPhase() else { return }
        messages.append(ConversationMessage(role: .assistant, content: phase.guidePrompt))
        phase = next
    }

    func generateSummary() async {
        state = .processing
        do {
            summary = try await openAIService.summarizeJournal(transcript: conversationTranscript)
            state = .complete
        } catch {
            errorMessage = error.localizedDescription
            state = .idle
        }
    }

    // MARK: - Private helpers

    private func sendToAI() async {
        do {
            let response = try await openAIService.sendMessage(messages: messages)
            messages.append(ConversationMessage(role: .assistant, content: response))
            state = .idle
        } catch {
            errorMessage = error.localizedDescription
            state = .idle
        }
    }

    private func nextPhase() -> JournalPhase? {
        switch phase {
        case .wings: return .highs
        case .highs: return .lows
        case .lows: return .done
        case .done: return nil
        }
    }
}
