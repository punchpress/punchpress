# Desktop Release

PunchPress desktop releases are packaged with Electron Builder, signed with the local Apple `Developer ID Application` certificate, notarized with Apple's notary service, and published to S3 for auto-updates.

## Required Environment

Create a repo-level `.env` file with:

```bash
APPLE_ID=your_apple_id@example.com
APPLE_APP_SPECIFIC_PASSWORD=your_app_specific_password_here
APPLE_TEAM_ID=your_apple_team_id_here
AWS_ACCESS_KEY_ID=your_aws_access_key_for_s3_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_for_s3_here
```

These names match the working MerchBase release setup.

## One-Time Machine Setup

1. Install the Apple `Developer ID Application` certificate into the macOS login keychain.
2. Create the S3 bucket `punchpress-electron-app-209596837609-us-east-1-an` in `us-east-1`.
3. Keep S3 Object Ownership at the default `Bucket owner enforced`.
4. Add a bucket policy that allows public `s3:GetObject` access to the release files so auto-update downloads work.
5. Keep S3 Block Public Access for ACLs enabled. Electron Builder is configured to upload without ACLs (`acl: null`), so public access comes only from the bucket policy.

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

- `build:desktop` signs and notarizes the macOS app when the Apple certificate and `.env` file are present.
- `build:desktop:unsigned` skips signing and notarization for local packaging checks.
- `publish:desktop` uploads the DMG, ZIP, and updater metadata to S3 with `electron-builder --publish always`.

## Auto-Update Flow

- Packaged builds check S3 for updates a few seconds after launch.
- macOS auto-update requires the published ZIP artifact in addition to the DMG. The DMG is for manual installs; `latest-mac.yml` should point to the ZIP.
- Update checks repeat every 10 minutes while the app is running.
- When an update finishes downloading, PunchPress prompts the user to restart and install it.
