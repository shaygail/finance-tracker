# Gmail OAuth — invoice inbox sync

Connect one or more Gmail / Google Workspace inboxes so supplier invoices appear under **Invoices**.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or pick an existing one)
3. Enable **Gmail API** (APIs & Services → Library → Gmail API → Enable)
4. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal if Workspace-only and you have that option)
   - App name: e.g. `STLL HAUS Finance`
   - Add your email as developer contact
   - Scopes: add
     - `.../auth/gmail.readonly`
     - `.../auth/userinfo.email`
   - **Test users**: add each Gmail you will connect (all 3 if needed)
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - Local: `http://localhost:3000/api/gmail/callback`
     - Vercel: `https://YOUR-APP.vercel.app/api/gmail/callback`
6. Copy **Client ID** and **Client secret**

## 2. Environment variables

Add to `.env` (local) and Vercel project settings:

```bash
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="...."
# Optional override (defaults to NEXTAUTH_URL + /api/gmail/callback)
# GOOGLE_REDIRECT_URI="http://localhost:3000/api/gmail/callback"

# Optional — customise which mail is treated as invoices
# GMAIL_SEARCH_QUERY="has:attachment (subject:invoice OR subject:receipt OR \"tax invoice\") newer_than:2y"
```

Restart `npm run dev` after changing `.env`.

## 3. Connect accounts

1. Sign in as **owner**
2. Open **Invoices**
3. Click **Connect Gmail** — pick the first inbox → Allow
4. Repeat for your other Gmail / Workspace accounts (up to all 3)
5. Click **Sync invoices**

## Notes

- **Free** for normal personal / small-business use (Gmail API quota)
- App stays in **Testing** mode until Google verification — only listed test users can connect
- Workspace admins may need to allow the app for company accounts
- Read-only scope — the app never sends or deletes mail
- Tokens are stored per business; only the owner can connect / sync / disconnect
