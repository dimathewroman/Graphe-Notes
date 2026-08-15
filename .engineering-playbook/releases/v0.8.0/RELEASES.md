# Release Registry

This registry records the exact `PLAYBOOK.md` checksum associated with each published playbook release. A project's pinned adoption is valid when its version and checksum match one row. Every material task still checks the newest registered stable release for relevant improvements and current-source review.

The Git tag and tagged commit identify the complete governance repository for a release, including templates and validation. The playbook checksum identifies the canonical shared operating standard that consuming projects explicitly adopt.

| Version | Git tag | PLAYBOOK SHA-256 |
|---:|---|---|
| 0.8.0 | `v0.8.0` | `fdfeedb9894c25652a74a7e763edfe9aa6ae6ce8b0d88fb74137ddef2236b834` |
| 0.2.1 | `v0.2.1` | `4d9079538fc10d0986397ed92ff23ff11e7a370c50645627758543bf707955d8` |
| 0.2.2 | `v0.2.2` | `63e5bbecb43c8a12c039cd20b7725894e21a57b5092061b5178959f14281b754` |
| 0.2.3 | `v0.2.3` | `96aeeef7abb6207601a12979f16c44162dbdd489099fed158d3660d5fee67a00` |
| 0.3.0 | `v0.3.0` | `21767aa86aade5dbc15ecab0f992a93495f38fff23e3da175340d37627bea389` |
| 0.3.1 | `v0.3.1` | `489f35f307fa960932ed19b70210aca811f35c1f33893ec9ce76cd72fd64929e` |
| 0.3.2 | `v0.3.2` | `00e198cd629c62866806e46df2644b8a3f3d4b339c20b5361ad6873bc105b38b` |
| 0.3.3 | `v0.3.3` | `564ae196621e606441679ee7d76d9732a7d460ade5d464fff2e32ebbb267387a` |
| 0.3.4 | `v0.3.4` | `3617f6ccffb2cbeb77acec79312224714bba27fce4bd1408d11575652a188795` |
| 0.3.5 | `v0.3.5` | `e6f626bf27f174fb8706ae149fda9e20fb78bb2f8804b87186b1607561f8fa10` |
| 0.3.6 | `v0.3.6` | `1550501a4eb8a89761522cbd83eb1284ba4c33789ceb5dae044a2b5ef67d13da` |
| 0.4.0 | `v0.4.0` | `f28af8a650cc7bc0da4e290aae7e572d4593a3260f620235221d6e103c1b3777` |
| 0.4.1 | `v0.4.1` | `584df63726b770c92819794e8494a1a7e60c58a955588163dfccdad2e3f2c655` |
| 0.5.0 | `v0.5.0` | `14c38cee615902f162d7c6c309c999ac9e5dbe499bbb79e2c6dcbd3dba59c566` |
| 0.6.0 | `v0.6.0` | `d3ac88dd3802ef3a54ed7394af3ae6e6802ba284818e55e80819fe7cdf2a5af0` |
| 0.7.0 | `v0.7.0` | `ff4cc12d17367993611f847c62314ed6eba2f85dc00f4a2c0ca837b7ed2d92e3` |

Add a row only as part of a versioned release. Verify the checksum from the completed `PLAYBOOK.md`, review the complete diff, and tag the exact release commit. Updating this registry makes newer guidance discoverable but never changes a project's adopted baseline; that requires a separate change in the consuming project.
