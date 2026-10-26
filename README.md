# Neobrutal Chat — WhatsApp-style iOS Social Chat Platform (Firebase Edition)

🔥 **Database: Firebase Firestore** (projekwhattsaf)
🎨 Tema: **Neobrutalism** (ungu/pink/kuning, border tebal, hard shadow)

## ✨ Fitur

- 🔐 **Auth**: Firebase Auth (email/password), akun pertama otomatis jadi Superadmin
- 💬 **Real-time Chat Pribadi**: via Socket.io, dengan read receipts, reactions, reply, typing indicator
- 🌍 **Global Chat**: ruang publik dengan mention @username
- 👥 **Grup**: create, join, leave, public/private, real-time messages
- 📢 **Channel**: create, follow/unfollow, posts
- 📱 **Stories**: text + color background, 24-jam expiry, viewer counter, reactions
- 🎤 **Voice Note**: MediaRecorder API
- 📷 **Media Upload**: gambar, video, dokumen (max 15MB) → Firebase Storage
- 📞 **Voice/Video Call**: WebRTC + Socket.io signaling
- 🔍 **Search**: Ctrl+K untuk user, grup, channel
- 🔔 **Notifications**: real-time via socket
- 🛡️ **Admin Panel**: stats dashboard, user management, banner broadcast
- 🌓 **Dark/Light Mode**: penuh

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + Neobrutalism custom CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Real-time**: Socket.io (mini-service di port 3003)
- **Calls**: WebRTC + STUN publik + TURN open relay
- **Font**: Space Grotesk

## ⚠️ PENTING: Setup Firebase Console

Sebelum aplikasi berfungsi penuh, Anda perlu setup Firebase project Anda:

### 1. Aktifkan Firestore Database
1. Buka [Firebase Console](https://console.firebase.google.com/) → project `projekwhattsaf`
2. Klik **Firestore Database** → **Create database** → **Production mode**
3. Pilih region (misal `asia-southeast1`)

### 2. Setup Firestore Security Rules
1. Di Firestore Database → tab **Rules**
2. Copy paste isi file `firestore.rules` dari project ini
3. Klik **Publish**

### 3. Aktifkan Firebase Authentication
1. Klik **Authentication** → **Get started**
2. Tab **Sign-in method** → aktifkan **Email/Password**

### 4. Aktifkan Firebase Storage
1. Klik **Storage** → **Get started**
2. Setup security rules dari file `storage.rules`

### 5. (Opsional) Setup Service Account untuk Admin Functions
Beberapa fitur admin (ban user, broadcast banner, dll) membutuhkan Firebase Admin SDK:
1. Buka **Project Settings** (gear icon) → **Service Accounts** tab
2. Klik **Generate new private key** → download JSON file
3. Set environment variable `FIREBASE_SERVICE_ACCOUNT` dengan isi JSON:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"projekwhattsaf",...}'
   ```
   Atau di file `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"projekwhattsaf",...}
   ```

## 📦 Cara Install & Run

### 1. Extract ZIP
```bash
unzip neobrutal-chat-firebase.zip -d neobrutal-chat
cd neobrutal-chat
```

### 2. Install dependencies
```bash
bun install
# atau: npm install
```

### 3. Setup environment
File `.env` sudah disertakan:
```
NEXTAUTH_SECRET="..."  # tidak digunakan lagi (legacy)
FIREBASE_ADMIN_EMAIL="admin@neobrutal.test"  # untuk fallback server-side
FIREBASE_ADMIN_PASSWORD="password123"
# FIREBASE_SERVICE_ACCOUNT={...}  # opsional, untuk Admin SDK
```

### 4. Setup Firebase Console (lihat section di atas)

### 5. Jalankan Socket.io mini-service
```bash
cd mini-services/chat-service
bun install
bun run dev
# Jalan di port 3003
```

### 6. Jalankan Next.js app
```bash
# Di root project
bun run dev
```

Buka http://localhost:3000 di browser.

### 7. Register akun pertama
Akun pertama yang diregister **otomatis menjadi Superadmin**.

### 8. (Optional) Seed data awal
Buka `http://localhost:3000/seed.html` di browser, login dengan akun admin Anda, dan klik "Run Seeder" untuk setup banner & welcome message.

## 📁 Struktur Project

```
neobrutal-chat/
├── prisma/                    # Legacy (Prisma SQLite, tidak digunakan untuk Firebase)
├── public/
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── seed.html              # Seeder untuk Firebase
├── mini-services/
│   └── chat-service/
│       └── index.ts           # Socket.io server (port 3003)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/firebase/         # Login/set cookie/logout
│   │   │   └── firebase/              # REST API (perlu Admin SDK)
│   │   │       ├── users/
│   │   │       ├── messages/dm/
│   │   │       ├── messages/global/
│   │   │       ├── stories/
│   │   │       ├── groups/
│   │   │       ├── channels/
│   │   │       ├── calls/
│   │   │       ├── admin/
│   │   │       ├── notifications/
│   │   │       ├── media/
│   │   │       └── search/
│   │   ├── globals.css        # Neobrutalism theme
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/             # UI components (sama dengan versi Prisma)
│   ├── hooks/
│   │   └── use-voice-recorder.ts
│   └── lib/
│       ├── firebase.ts         # Client SDK config
│       ├── firebase-server.ts  # Admin SDK (perlu service account)
│       ├── session.ts          # Cookie helper
│       ├── webrtc.ts           # WebRTC class
│       ├── api.ts              # API client
│       ├── types.ts
│       └── utils.ts
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json      # Firestore indexes
├── storage.rules              # Storage security rules
├── firebase.json              # Firebase config
├── Caddyfile                  # Gateway (port 81)
├── package.json
└── README.md                  # File ini
```

## 🔥 Firebase Config

Project Firebase Anda yang dipakai:
```
Project ID:    projekwhattsaf
Auth Domain:   projekwhattsaf.firebaseapp.com
Storage:       projekwhattsaf.firebasestorage.app
API Key:       AIzaSyDrAYKLg_Go-UiqB3tmQbHEudQXYzKm3s0
```

## 📊 Struktur Database (Firestore Collections)

```
users/{uid}                    # Profile user
  - email, username, displayName, bio, photoURL
  - role (user|admin|superadmin), banned, verified
  - online, lastSeen, createdAt

usernames/{username}           # Username → UID mapping (unique)
  - uid, createdAt

dms/{messageId}                # Direct messages
  - chatId (sorted pair: uidA_uidB)
  - senderId, receiverId
  - text, type, mediaURL
  - status (sent|delivered|read)
  - reactions (JSON)
  - createdAt

global/{messageId}             # Global chat
  - senderId, senderUsername, text, type, mediaURL
  - reactions, pinned
  - createdAt

stories/{storyId}              # Stories (24h expiry)
  - ownerId, type, text, mediaURL, bg
  - duration, audience, expiresAt, createdAt
  - viewers/{viewerId}        # Subcollection
  - reactions/{userId}         # Subcollection

groups/{groupId}              # Groups
  - name, description, photoURL
  - ownerId, visibility, joinPolicy
  - inviteCode, memberCount, createdAt
  - members/{memberId}        # Subcollection

group_messages/{messageId}     # Group messages
  - groupId, senderId, text, type, mediaURL
  - reactions, createdAt

channels/{channelId}           # Channels
  - name, slug, description, photoURL
  - ownerId, visibility, followerCount, createdAt

channel_follows/{followId}     # Channel follows
  - channelId, userId, createdAt

channel_posts/{postId}         # Channel posts
  - channelId, authorId, text, mediaURL
  - pinned, viewCount, reactions, createdAt

calls/{callId}                 # Call records
  - callerId, calleeId, callType, status
  - startedAt, endedAt, durationSeconds, createdAt

notifications/{notifId}       # Notifications
  - recipientId, actorId, type, targetType, targetId
  - text, read, createdAt

config/{key}                   # App config (banner, dll)
  - banner: { text, active, kind, updatedAt }
```

## 🎨 Tema Neobrutalism

Palet warna utama:
- **Ungu** (primary): `#8b5cf6`
- **Pink** (accent): `#ff4d8d`
- **Kuning** (secondary): `#ffe94d`
- **Cyan**: `#7ef9ee`
- **Hijau neon**: `#5cf29a`
- **Hitam border**: `#111111` (light) / `#f4f4f4` (dark)
- **Shadow**: `4px 4px 0` offset

## 📞 Konfigurasi WebRTC Call

Default memakai STUN publik Google + TURN open relay (Metered). Untuk produksi:

### Setup Coturn sendiri
```bash
sudo apt install coturn
# Edit /etc/turnserver.conf
# listening-port=3478
# external-ip=YOUR_VPS_IP
# realm=yourdomain.com
# user=youruser:yourpassword
# lt-cred-mech
sudo systemctl enable coturn && sudo systemctl start coturn
```

Edit `src/lib/webrtc.ts`:
```ts
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.yourdomain.com:3478" },
    { urls: "turn:yourdomain.com:3478", username: "youruser", credential: "yourpassword" },
  ],
}
```

## 🐛 Troubleshooting

**"Missing or insufficient permissions" saat register/chat**
→ Setup Firestore security rules (lihat section di atas)

**API routes return 500 (Admin SDK not configured)**
→ Set FIREBASE_SERVICE_ACCOUNT env var dengan service account JSON dari Firebase Console

**Socket.io tidak connect**
→ Pastikan mini-service chat-service berjalan di port 3003
→ Akses via Caddy gateway (port 81), bukan port 3000 langsung

**Voice/Video call gagal**
→ Browser butuh izin mikrofon & kamera
→ HTTPS wajib (kecuali localhost)
→ Cek TURN server reachable

## 📝 Lisensi

MIT License

---

Dibuat dengan tema Neobrutalism 🎨 dan Firebase 🔥
