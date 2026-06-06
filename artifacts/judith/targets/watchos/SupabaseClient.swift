// SupabaseClient.swift — intentionally empty.
//
// The Watch app no longer calls Supabase directly.
// Bills live in the phone's local store; the phone pushes summaries via
// WatchConnectivity (see ConnectivityService.swift).
// Auth, mark-paid, and Ask queries all go through the phone.
