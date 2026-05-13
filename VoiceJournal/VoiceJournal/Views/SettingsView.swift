import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey: String = ""
    @State private var showingAPIKey = false
    @State private var reminderEnabled = false
    @State private var reminderTime: Date = defaultReminderTime()

    var body: some View {
        NavigationStack {
            Form {
                apiKeySection
                reminderSection
                aboutSection
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { loadSettings() }
        }
    }

    // MARK: - Sections

    private var apiKeySection: some View {
        Section {
            HStack {
                Label("OpenAI API Key", systemImage: "key")
                Spacer()
                Text(apiKey.isEmpty ? "Not set" : "Configured")
                    .foregroundStyle(apiKey.isEmpty ? .red : .green)
                    .font(.subheadline)
            }
            .contentShape(Rectangle())
            .onTapGesture { showingAPIKey.toggle() }

            if showingAPIKey {
                SecureField("sk-...", text: $apiKey)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Button("Save Key") {
                    UserDefaults.standard.set(apiKey, forKey: "openai_api_key")
                    showingAPIKey = false
                }
                .foregroundStyle(.indigo)
            }
        } header: {
            Text("AI Configuration")
        } footer: {
            Text("Your key is stored locally on this device. Get one at platform.openai.com.")
        }
    }

    private var reminderSection: some View {
        Section {
            Toggle(isOn: $reminderEnabled) {
                Label("Daily Reminder", systemImage: "bell")
            }
            .onChange(of: reminderEnabled) { _, enabled in
                Task { await handleReminderToggle(enabled: enabled) }
            }

            if reminderEnabled {
                DatePicker(
                    "Reminder Time",
                    selection: $reminderTime,
                    displayedComponents: .hourAndMinute
                )
                .onChange(of: reminderTime) { _, time in
                    Task { await updateReminderTime(time) }
                }
            }
        } header: {
            Text("Daily Reminder")
        } footer: {
            if reminderEnabled {
                Text("You'll receive a daily notification to journal.")
            }
        }
    }

    private var aboutSection: some View {
        Section("About") {
            HStack {
                Text("Journal Format")
                Spacer()
                Text("Wings · Highs · Lows")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            }
            HStack {
                Text("AI Model")
                Spacer()
                Text("GPT-4o")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            }
        }
    }

    // MARK: - Helpers

    private func loadSettings() {
        apiKey = UserDefaults.standard.string(forKey: "openai_api_key") ?? ""
        reminderEnabled = UserDefaults.standard.bool(forKey: "reminderEnabled")

        let hour = UserDefaults.standard.integer(forKey: "reminderHour")
        let minute = UserDefaults.standard.integer(forKey: "reminderMinute")
        reminderTime = Calendar.current.date(
            bySettingHour: hour == 0 ? 21 : hour,
            minute: minute,
            second: 0,
            of: Date()
        ) ?? Self.defaultReminderTime()
    }

    private func handleReminderToggle(enabled: Bool) async {
        UserDefaults.standard.set(enabled, forKey: "reminderEnabled")
        if enabled {
            let granted = await NotificationService.shared.requestAuthorization()
            if granted {
                await scheduleReminder()
            } else {
                await MainActor.run { reminderEnabled = false }
                UserDefaults.standard.set(false, forKey: "reminderEnabled")
            }
        } else {
            NotificationService.shared.cancelDailyReminder()
        }
    }

    private func updateReminderTime(_ time: Date) async {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: time)
        UserDefaults.standard.set(comps.hour ?? 21, forKey: "reminderHour")
        UserDefaults.standard.set(comps.minute ?? 0, forKey: "reminderMinute")
        if reminderEnabled { await scheduleReminder() }
    }

    private func scheduleReminder() async {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: reminderTime)
        await NotificationService.shared.scheduleDailyReminder(
            hour: comps.hour ?? 21,
            minute: comps.minute ?? 0
        )
    }

    private static func defaultReminderTime() -> Date {
        Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: Date()) ?? Date()
    }
}
