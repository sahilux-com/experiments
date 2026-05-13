import Foundation

struct JournalSummary: Codable {
    let wings: String
    let highs: String
    let lows: String
}

final class OpenAIService {
    private let apiKey: String
    private let baseURL = URL(string: "https://api.openai.com/v1/chat/completions")!

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    // MARK: - Types

    private struct ChatMessage: Codable {
        let role: String
        let content: String
    }

    private struct ChatRequest: Codable {
        let model: String
        let messages: [ChatMessage]
        let temperature: Double
        let max_tokens: Int
    }

    private struct ChatResponse: Codable {
        let choices: [Choice]
        struct Choice: Codable {
            let message: ChatMessage
        }
    }

    // MARK: - Public API

    func sendMessage(messages: [ConversationMessage]) async throws -> String {
        let chatMessages = messages.map { ChatMessage(role: $0.role.rawValue, content: $0.content) }
        let body = ChatRequest(model: "gpt-4o", messages: chatMessages, temperature: 0.7, max_tokens: 500)

        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw OpenAIError.invalidResponse
        }
        guard http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw OpenAIError.apiError(http.statusCode, msg)
        }

        let chat = try JSONDecoder().decode(ChatResponse.self, from: data)
        guard let text = chat.choices.first?.message.content else {
            throw OpenAIError.emptyResponse
        }
        return text
    }

    func summarizeJournal(transcript: String) async throws -> JournalSummary {
        let systemPrompt = """
        You are a personal journal assistant. Analyze the following voice journal conversation \
        and extract a structured summary.

        Return a JSON object with exactly these fields:
        {
            "wings": "What gave the person energy, lifted their spirit, or what they're proud of today",
            "highs": "The best moments, achievements, or positive experiences of the day",
            "lows": "The challenges, difficulties, or disappointments faced today"
        }

        Each value must be 1–3 concise sentences. If there was nothing meaningful discussed for \
        a section, write an empty string "".
        Return ONLY the JSON object — no markdown fences, no other text.
        """

        let messages: [ConversationMessage] = [
            ConversationMessage(role: .system, content: systemPrompt),
            ConversationMessage(role: .user, content: "Journal conversation:\n\n\(transcript)")
        ]

        let raw = try await sendMessage(messages: messages)
        let cleaned = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = cleaned.data(using: .utf8) else { throw OpenAIError.parsingError }
        return try JSONDecoder().decode(JournalSummary.self, from: data)
    }

    // MARK: - Errors

    enum OpenAIError: Error, LocalizedError {
        case invalidResponse
        case apiError(Int, String)
        case emptyResponse
        case parsingError

        var errorDescription: String? {
            switch self {
            case .invalidResponse: return "Invalid server response"
            case .apiError(let code, let msg): return "API error \(code): \(msg)"
            case .emptyResponse: return "Empty response from API"
            case .parsingError: return "Failed to parse journal summary"
            }
        }
    }
}
