# Health Agg iOS

Native SwiftUI client. Tabs: Today (dashboard cards + sparklines), Sleep, Recovery,
Activity (30-day charts + provider-tagged rows), Connections (OAuth via
`ASWebAuthenticationSession`, Eight Sleep credentials sheet, sync now, sign out).

## Setup

1. Install Xcode 16+.
2. Put the Supabase anon/publishable key in `HealthAgg/Core/Config.swift`
   (Dashboard → Settings → API). The project URL is already set.
3. The `.xcodeproj` is generated from `project.yml`:
   ```sh
   brew install xcodegen   # once
   xcodegen generate       # re-run after adding/removing files
   ```
4. Open `HealthAgg.xcodeproj`, let SPM resolve `supabase-swift`, build & run.

## OAuth callback

Provider OAuth flows finish at the `oauth/callback` edge function, which
redirects to `healthagg://connected?provider=…` — the URL scheme is registered
in `project.yml`, and `ASWebAuthenticationSession` closes on it.

## Local development

To point at the local stack, a simulator can use `http://127.0.0.1:55321`; a
physical device needs your Mac's LAN IP. Update `Config.supabaseURL` + key
accordingly.
