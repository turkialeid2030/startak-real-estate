# P8 CI Contract

The P8 executable regression file is placed under `tests/runtime`, which the canonical `tools/release-verify.js` discovers by executing every `.js` file in that directory.

CI success can establish only that the repository's automated release-verification checks passed for the tested commit. CI success does not authorize release, merge, deployment, go-live, transaction execution, or production validation.
