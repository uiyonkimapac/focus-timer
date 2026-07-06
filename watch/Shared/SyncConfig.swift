import Foundation

// Same backend the web app talks to (index.html SUPABASE_URL / SUPABASE_KEY).
// The anon key is publishable by design — identical to the one in the page source.
enum SyncConfig {
    static let supabaseURL = URL(string: "https://ghmdvkmempbnjcamqzuc.supabase.co")!
    static let anonKey = "sb_publishable_N9WHWagfhXCQ67fVqh8Q2g_Jn6bohWX"
    static let defaultSyncCode = "FT-WQDP-8N"

    static var syncCode: String {
        get { UserDefaults.standard.string(forKey: "syncCode") ?? defaultSyncCode }
        set { UserDefaults.standard.set(newValue, forKey: "syncCode") }
    }
}
