import Foundation

struct ConversationMessage: Identifiable, Codable {
    let id: UUID
    let role: MessageRole
    let content: String

    init(role: MessageRole, content: String) {
        self.id = UUID()
        self.role = role
        self.content = content
    }

    enum MessageRole: String, Codable {
        case system
        case user
        case assistant
    }
}
