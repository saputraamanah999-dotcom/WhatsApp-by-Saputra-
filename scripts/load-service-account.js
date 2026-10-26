#!/usr/bin/env node
/**
 * Helper script: load service account dari file JSON atau env var
 * dan print sebagai single-line JSON untuk env var
 *
 * Cara pakai:
 *   1. Download service account JSON dari Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *      Simpan dengan nama: service-account.json (di root project)
 *
 *   2. Jalankan script ini:
 *      node scripts/load-service-account.js
 *
 *   3. Copy output ke file .env Anda:
 *      FIREBASE_SERVICE_ACCOUNT=<paste output disini>
 *
 *   4. Restart Next.js dev server
 */

const fs = require("fs")
const path = require("path")

const saPath = path.join(process.cwd(), "service-account.json")

if (!fs.existsSync(saPath)) {
  console.error("\n❌ File service-account.json tidak ditemukan di root project.")
  console.error("\nCara dapatkan:")
  console.error("  1. Buka https://console.firebase.google.com/")
  console.error("  2. Pilih project: projekwhattsaf")
  console.error("  3. Klik gear icon ⚙️ (Project Settings)")
  console.error("  4. Tab Service Accounts")
  console.error("  5. Klik 'Generate new private key'")
  console.error("  6. Download file JSON")
  console.error("  7. Rename jadi 'service-account.json' dan taruh di root project ini\n")
  process.exit(1)
}

try {
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"))

  // Validate required fields
  const required = ["type", "project_id", "private_key", "client_email"]
  const missing = required.filter((k) => !sa[k])
  if (missing.length > 0) {
    console.error("❌ File service-account.json tidak valid. Missing fields:", missing.join(", "))
    process.exit(1)
  }

  if (sa.project_id !== "projekwhattsaf") {
    console.warn(`⚠️  Warning: project_id di file adalah "${sa.project_id}", bukan "projekwhattsaf".`)
    console.warn("   Pastikan file service account yang benar.\n")
  }

  // Convert to single-line JSON
  const singleLine = JSON.stringify(sa)
  console.log("\n✅ Service account loaded successfully!")
  console.log(`   Project ID: ${sa.project_id}`)
  console.log(`   Client email: ${sa.client_email}`)
  console.log(`   File size: ${Buffer.byteLength(singleLine)} bytes\n`)

  console.log("📋 Copy baris di bawah ini dan tambahkan ke file .env Anda:\n")
  console.log("─".repeat(80))
  console.log(`FIREBASE_SERVICE_ACCOUNT=${singleLine}`)
  console.log("─".repeat(80))
  console.log("\nAtau jalankan langsung untuk auto-update .env:\n")
  console.log("  node scripts/load-service-account.js --apply\n")

  if (process.argv.includes("--apply")) {
    const envPath = path.join(process.cwd(), ".env")
    let envContent = ""
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8")
    }
    // Remove existing FIREBASE_SERVICE_ACCOUNT line if any
    envContent = envContent.replace(/^FIREBASE_SERVICE_ACCOUNT=.*$/gm, "")
    // Append new
    envContent = envContent.trimEnd() + `\n\n# Firebase Admin SDK (auto-added by load-service-account.js)\nFIREBASE_SERVICE_ACCOUNT=${singleLine}\n`
    fs.writeFileSync(envPath, envContent)
    console.log("✅ File .env berhasil diupdate!")
    console.log("   Sekarang restart Next.js dev server Anda.")
  }
} catch (e) {
  console.error("❌ Gagal parse service-account.json:", e.message)
  process.exit(1)
}
