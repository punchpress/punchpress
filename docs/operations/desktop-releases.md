---
summary: Captures macOS desktop release requirements for Electron Builder signing, notarization, S3 updater artifacts, and auto-update validation.
read_when:
  - setting up a release Mac for PunchPress desktop publishing
  - changing Electron Builder signing, notarization, S3 bucket, or auto-update behavior
  - debugging missing ZIP, latest-mac.yml, notarization, or updater download failures
---

# Desktop Releases

PunchPress desktop releases are packaged with Electron Builder, signed with a
local Apple `Developer ID Application` certificate, notarized by Apple, and
published to S3 for auto-updates.

## Environment

Create a repo-level `.env` file:

```bash
APPLE_ID=your_apple_id@example.com
APPLE_APP_SPECIFIC_PASSWORD=your_app_specific_password_here
APPLE_TEAM_ID=your_apple_team_id_here
AWS_ACCESS_KEY_ID=your_aws_access_key_for_s3_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_for_s3_here
```

## One-Time Machine Setup

1. Install the Apple `Developer ID Application` certificate in the macOS login
   keychain.
2. Create S3 bucket `punchpress-electron-app-209596837609-us-east-1-an` in
   `us-east-1`.
3. Keep S3 Object Ownership at `Bucket owner enforced`.
4. Keep S3 Block Public Access for ACLs enabled.
5. Add a bucket policy that allows public `s3:GetObject` for release files.

Electron Builder publishes with `acl: null`; public access comes from the bucket
policy, not object ACLs.

Example bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadReleaseArtifacts",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::punchpress-electron-app-209596837609-us-east-1-an/*"
    }
  ]
}
```

## Commands

```bash
bun run build:desktop
bun run build:desktop:unsigned
bun run publish:desktop
```

| Command | Use |
| --- | --- |
| `build:desktop` | Signed and notarized macOS build when Apple env and cert are present. |
| `build:desktop:unsigned` | Local packaging check without signing or notarization. |
| `publish:desktop` | Uploads DMG, ZIP, blockmap, and updater metadata to S3. |

## Auto-Update Contract

- Packaged builds check S3 shortly after launch.
- Checks repeat every 10 minutes while the app is running.
- macOS auto-update requires the ZIP artifact in addition to the DMG.
- `latest-mac.yml` must point to the ZIP feed used by `electron-updater`.
- After download, PunchPress prompts the user to restart and install.

## Validation

After publishing, confirm these exist under the S3 `mac/` prefix:

- DMG
- ZIP
- blockmap
- `latest-mac.yml`

Then install or update from a prior packaged build to verify the updater
downloads the new release.
