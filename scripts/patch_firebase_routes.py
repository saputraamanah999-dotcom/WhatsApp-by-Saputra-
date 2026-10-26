#!/usr/bin/env python3
"""Patch all Firebase API routes to call ensureAdminSignedIn() before getAdminDb()"""
import re
import glob

base = "/home/z/my-project/src/app/api/firebase"
files = glob.glob(f"{base}/**/route.ts", recursive=True)
patched = 0
for f in files:
    with open(f, "r") as fh:
        content = fh.read()
    if "ensureAdminSignedIn" not in content:
        continue
    new_content = content
    # Insert ensureAdminSignedIn() before each "const adminDb = getAdminDb()"
    if "const adminDb = getAdminDb()" in new_content and "await ensureAdminSignedIn()\n  const adminDb" not in new_content:
        new_content = new_content.replace(
            "const adminDb = getAdminDb()",
            "await ensureAdminSignedIn()\n  const adminDb = getAdminDb()"
        )
    if new_content != content:
        with open(f, "w") as fh:
            fh.write(new_content)
        patched += 1
        print(f"  Patched: {f}")
print(f"\nTotal patched: {patched}")
