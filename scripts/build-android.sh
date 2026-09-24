#!/usr/bin/env bash
set -euo pipefail

# Never fall back to Expo's public debug key for distributable builds.
for name in KEYSTORE_BASE64 KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Missing repository secret: $name"
    exit 1
  fi
done

keystore=$(mktemp "${RUNNER_TEMP:-/tmp}/smartbasket-signing-XXXXXX.jks")
trap 'rm -f "$keystore"' EXIT
chmod 600 "$keystore"
printf '%s' "$KEYSTORE_BASE64" | base64 --decode > "$keystore"
keytool -list -keystore "$keystore" -storepass:env KEYSTORE_PASSWORD -alias "$KEY_ALIAS" > /dev/null

cd android
chmod +x gradlew
./gradlew :app:assembleRelease :app:bundleRelease \
  --no-daemon --build-cache --max-workers=2 \
  '-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g' \
  -PreactNativeArchitectures=arm64-v8a,x86_64 \
  "-Pandroid.injected.signing.store.file=$keystore" \
  "-Pandroid.injected.signing.store.password=$KEYSTORE_PASSWORD" \
  "-Pandroid.injected.signing.key.alias=$KEY_ALIAS" \
  "-Pandroid.injected.signing.key.password=$KEY_PASSWORD"
