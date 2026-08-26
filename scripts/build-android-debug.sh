#!/bin/sh
set -eu

cd "$(dirname "$0")/../android"
exec ./gradlew :app:assembleDebug :app:testDebugUnitTest
