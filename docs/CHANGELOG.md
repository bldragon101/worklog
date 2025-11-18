## [1.3.0](https://github.com/bldragon101/worklog/compare/v1.2.0...v1.3.0) (2025-11-18)

### Features

* Add customizable pagination and jobs stats UI ([3b254a0](https://github.com/bldragon101/worklog/commit/3b254a0604cf9b9311fdf9367c920ea6a6df8bf5))
* Add JobsStatsBar tests and simplify memoization ([23c381e](https://github.com/bldragon101/worklog/commit/23c381ea6e2d247f96ce4b1257f561c7b3727fe1))
* Add multi-driver selection and batch RCTI ([634a7ad](https://github.com/bldragon101/worklog/commit/634a7adc4e4e926416b18f4bf8e9bc89f1317358))
* Add payroll page, sidebar and permissions ([9fc5c9f](https://github.com/bldragon101/worklog/commit/9fc5c9f350d60deb6631b1bb63d1b85135230f08))
* Add per-RCTI deduction overrides and scheduling ([b0240b5](https://github.com/bldragon101/worklog/commit/b0240b5e7b908f537ad8df378670914b265156fa))
* Add RCTI break, toll and fuel levy logic ([1805d98](https://github.com/bldragon101/worklog/commit/1805d9858af1d44b9b6f21d1f17e9bfa9b744186))
* Add RCTI Deductions API validation tests ([a4ed721](https://github.com/bldragon101/worklog/commit/a4ed721eaa3170e1d56184aa3ed21e2e21547f95))
* Add RCTI feature ([5924259](https://github.com/bldragon101/worklog/commit/592425932cce95f02abed8ce48b25f7646c61585))
* Add RCTI feature with deductions and migrations ([5c59f49](https://github.com/bldragon101/worklog/commit/5c59f49eb7232bb6078b90d237d9f509da2b71f6))
* Add RCTI manual lines tests ([07ff030](https://github.com/bldragon101/worklog/commit/07ff030e5fab397669402431c5882fc1df000136))
* Add RCTI refresh, line deletion, and filters ([c8ef529](https://github.com/bldragon101/worklog/commit/c8ef5298006d72e4742b57d1debfa65525fb3921))
* Add RCTI settings and PDF export ([8342ee3](https://github.com/bldragon101/worklog/commit/8342ee3562f81cb201a3ceab542c8d01bf71dab7))
* Add Suspense to OverviewPage and RCTI tests ([6854444](https://github.com/bldragon101/worklog/commit/6854444731b3c8ab0a5673d89e65b6084b8f8c5b))
* Bump dependencies and fix auth session ([fea1795](https://github.com/bldragon101/worklog/commit/fea17956f92d477e36f8247ac054cafe090a7031))
* Compute job stats reactively and remove manual refresh ([9a29b31](https://github.com/bldragon101/worklog/commit/9a29b31dcc45ac32edffb9302675124e7466f198))
* Convert project configs to TypeScript ([d5990e6](https://github.com/bldragon101/worklog/commit/d5990e68a7ca9be27f35f4943cbf68927cdf01bb))
* Default to active deductions; cancel applied ones ([aa654a9](https://github.com/bldragon101/worklog/commit/aa654a9ac26c385a7e9fa6d42be3fbcd0429232d))
* delete redundant tests ([b52433c](https://github.com/bldragon101/worklog/commit/b52433cd7a6a8974a53e04eef83074259d4722ae))
* Enable manual trigger for test workflow ([daf05da](https://github.com/bldragon101/worklog/commit/daf05da9a222bd97cd38dd5604c5b8c0f273fcfb))
* Include businessName in RCTI PDF template ([3a8fb67](https://github.com/bldragon101/worklog/commit/3a8fb67bf12a16a754c3913937b2df8975ed66ed))
* Introduce PermissionsProvider to centralize role and permission ([46fe866](https://github.com/bldragon101/worklog/commit/46fe8668bc06227e93e8eca78444b294e21d365a))
* Refactor RCTI calculations and user APIs ([e9f8c07](https://github.com/bldragon101/worklog/commit/e9f8c07db9e898372a620f690237dd58c1ef9ea1))
* Remove Claude GitHub workflows ([ea09ff4](https://github.com/bldragon101/worklog/commit/ea09ff4f3386fd9826974110c6eacaf6c8fa848b))
* Sync user roles to Clerk and add route guards ([435ae7f](https://github.com/bldragon101/worklog/commit/435ae7fdf209db735aa14b8d480e9a257a9536cc))
* Update Clerk public metadata only on role change ([d864f07](https://github.com/bldragon101/worklog/commit/d864f076d3fbf56226becfa70ce7cb4bb91a4b5e))
* Use pnpx for Prisma and add 1.3.0 notes ([e36993e](https://github.com/bldragon101/worklog/commit/e36993eac13d7cca2a144e8421aee0fb58a04eef))
* Use transaction and optimistic lock for deductions ([26666bf](https://github.com/bldragon101/worklog/commit/26666bf0d8691be2138160dd4f648f3a8dbada5a))

### Bug Fixes

* Add businessName support and RCTI settings ([151889e](https://github.com/bldragon101/worklog/commit/151889ee76effc97efd1668fdff6cc719d3542f3))
* Add permission check and include rate-limit headers ([2c5a33c](https://github.com/bldragon101/worklog/commit/2c5a33c82711998f4e0dce4700eb967136eb2a5a))
* Add Prisma enums for GST and status fields ([e90bbb0](https://github.com/bldragon101/worklog/commit/e90bbb0ec9b9ff41985fbd64d3e0de4838dac061))
* Add type annotation to resolve TypeScript error in RCTI page ([14e813f](https://github.com/bldragon101/worklog/commit/14e813fc5956c20b91c5b943a85fcdef3dedc4db))
* Cast numeric fields to Number ([9638633](https://github.com/bldragon101/worklog/commit/96386332860f093e3b240e2699e66df6b202e31c))
* Convert monetary fields to Decimal and adapt code ([0722755](https://github.com/bldragon101/worklog/commit/0722755e229b350c1da35a2427db8ba129cf1f17))
* Convert RCTI integration tests to unit tests ([0f08898](https://github.com/bldragon101/worklog/commit/0f088980b65c4f87b30fb87277fa6eb1dec2e675))
* Convert RCTI numeric fields using toNumber ([731415e](https://github.com/bldragon101/worklog/commit/731415ee74a6b635f92e8a28d10b3f4992fdfd48))
* Debounce global search and use in toolbar ([457148b](https://github.com/bldragon101/worklog/commit/457148bc84f59d59c16820c1699bcc3997a757e7))
* Extract Job-to-RCTI helpers and totals ([cb8d64d](https://github.com/bldragon101/worklog/commit/cb8d64d97a6be2f37ac7e5091181ebe1427f2047))
* Fix login redirect, validation, and break grouping ([8dbf7fa](https://github.com/bldragon101/worklog/commit/8dbf7fac530618b0aad045ad935bce90e55da0d8))
* Fix PDF template types and data mapping ([e1b05c7](https://github.com/bldragon101/worklog/commit/e1b05c78b6ebf8a50b508cd28f438d5abb63f09a))
* Fix RCTI deductions and totals logic ([dc72ed2](https://github.com/bldragon101/worklog/commit/dc72ed2d175de19f676cffd21cb2c72d5a571596))
* Fix RCTI PDF types and revert version bump ([a1b8030](https://github.com/bldragon101/worklog/commit/a1b803090712d8bbe61ab51016625f6c80502871))
* Fix request body handling in settings tests ([ddad617](https://github.com/bldragon101/worklog/commit/ddad61733d698319d348348abf0779a15c892834))
* Fix SSR logo comment; memoize permission check ([e1a0f1a](https://github.com/bldragon101/worklog/commit/e1a0f1acb4f189f93dfe8075e174a7734dd1d723))
* Fix truck type categorization and hours formatting Use ([aa53658](https://github.com/bldragon101/worklog/commit/aa5365862f3366ea8eddc7e712542438aad9c0a1))
* Normalize optional fields and update selectively ([82b8ad0](https://github.com/bldragon101/worklog/commit/82b8ad0b238fe426308b9342eca904fca85289b5))
* Refactor tests, add mocks/providers, fix nav map ([429de47](https://github.com/bldragon101/worklog/commit/429de47044fc4599304b94f603e4d10113cb5786))
* Remove debug logging and fix formatting ([8041c4c](https://github.com/bldragon101/worklog/commit/8041c4c34862ebabeca08be30f03e19bb958324a))
* remove sorting from columns that dont require it ([fecad04](https://github.com/bldragon101/worklog/commit/fecad04180c9f267b33c2a96fe61418c118ce3c4))
* Reset mocks for each image test case ([58182a1](https://github.com/bldragon101/worklog/commit/58182a17380d8e7280574d3e6eee8a4af86e6380))
* Restrict finalised/paid status and GST edits Reject direct PATCH ([f8c1f95](https://github.com/bldragon101/worklog/commit/f8c1f959862ffdcc31ba1330d2d77961fda03553))
* Strip spaces and dashes from ABN and BSB ([390baf6](https://github.com/bldragon101/worklog/commit/390baf655e54a802787af9c5b2c4068150f49841))
* Update changelog for v1.3.0 release ([f6186d3](https://github.com/bldragon101/worklog/commit/f6186d333f198d5f817bec8f2e73cb46619be13c))
* Update tests to expect two-decimal hours format ([4298c33](https://github.com/bldragon101/worklog/commit/4298c3334d7bb5fc0e054f1979876cbcc367dfa9))
* Use actual rcti-calculations module in tests ([de7433e](https://github.com/bldragon101/worklog/commit/de7433ea6fe771f9bf724f276cc8d82f3540bf9a))
* Use exported MAX_FUTURE_YEAR_OFFSET for year validation ([d51b5bc](https://github.com/bldragon101/worklog/commit/d51b5bc94f612047949d0c3427d4256ac89cbb3d))
* Use hierarchical role ranks in ProtectedRoute Replace explicit ([7e3d848](https://github.com/bldragon101/worklog/commit/7e3d8487892a1ed6be3266ba17b1aa6d6162de2f))
* Validate and parse driverId and date inputs ([beb433f](https://github.com/bldragon101/worklog/commit/beb433fbb432dad581479f5e9bb0b4ed70ee4c8e))
* Validate deduction override values in finalize ([4bbcde8](https://github.com/bldragon101/worklog/commit/4bbcde8cf008d123d12a411eb75dda520f5c7417))
* Validate job IDs and add rate-limit headers ([c01ce18](https://github.com/bldragon101/worklog/commit/c01ce186f229851ae3e57594cababcb57ac30bac))
* Validate RCTI and Line IDs are positive ([f5f5012](https://github.com/bldragon101/worklog/commit/f5f501246b16403447e79397ea529816f683bcbf))
* Validate RCTI lines and show empty state ([3c92010](https://github.com/bldragon101/worklog/commit/3c92010f1d5c3a6026bb41da620e18889f441078))

### Chores

* Bump dependencies and update changelog to v1.2.0 ([b237cd6](https://github.com/bldragon101/worklog/commit/b237cd679182048dbdc327e257b71c26b715b1bd))
* Bump dependencies and update lockfile ([ab803b8](https://github.com/bldragon101/worklog/commit/ab803b88231d1e7d08e73a4752604a39a1f392c3))
* **release:** 1.3.0-pre.1 [skip ci] ([b0c41c8](https://github.com/bldragon101/worklog/commit/b0c41c80d2d796d868da895c6d14111616fecb80))
* **release:** 1.3.0-pre.2 [skip ci] ([aa5f635](https://github.com/bldragon101/worklog/commit/aa5f635a3356b52a040a4146a7492e2eb03ae7da))
* **release:** 1.3.0-pre.3 [skip ci] ([8c8acea](https://github.com/bldragon101/worklog/commit/8c8acea66183d63e43ba020f97b42aa07ba6c0b8))
* **release:** 1.3.0-pre.4 [skip ci] ([30e9e52](https://github.com/bldragon101/worklog/commit/30e9e52593709e009f2e097265681dc0673f9f94))
* **release:** 1.3.0-pre.5 [skip ci] ([7c39823](https://github.com/bldragon101/worklog/commit/7c39823a2ee95602a16488f51c1e3c8e8b06982c))
* **release:** 1.3.0-pre.6 [skip ci] ([03bddd0](https://github.com/bldragon101/worklog/commit/03bddd088d102a83938937d115e154360f11c6ab))

## [1.3.0-pre.6](https://github.com/bldragon101/worklog/compare/v1.3.0-pre.5...v1.3.0-pre.6) (2025-11-18)

### Features

* Add per-RCTI deduction overrides and scheduling ([b0240b5](https://github.com/bldragon101/worklog/commit/b0240b5e7b908f537ad8df378670914b265156fa))
* Default to active deductions; cancel applied ones ([aa654a9](https://github.com/bldragon101/worklog/commit/aa654a9ac26c385a7e9fa6d42be3fbcd0429232d))

### Bug Fixes

* Cast numeric fields to Number ([9638633](https://github.com/bldragon101/worklog/commit/96386332860f093e3b240e2699e66df6b202e31c))
* Fix RCTI deductions and totals logic ([dc72ed2](https://github.com/bldragon101/worklog/commit/dc72ed2d175de19f676cffd21cb2c72d5a571596))
* Remove debug logging and fix formatting ([8041c4c](https://github.com/bldragon101/worklog/commit/8041c4c34862ebabeca08be30f03e19bb958324a))
* Validate deduction override values in finalize ([4bbcde8](https://github.com/bldragon101/worklog/commit/4bbcde8cf008d123d12a411eb75dda520f5c7417))

### Chores

* Bump dependencies and update lockfile ([ab803b8](https://github.com/bldragon101/worklog/commit/ab803b88231d1e7d08e73a4752604a39a1f392c3))

## [1.3.0-pre.5](https://github.com/bldragon101/worklog/compare/v1.3.0-pre.4...v1.3.0-pre.5) (2025-11-17)

### Features

* Enable manual trigger for test workflow ([daf05da](https://github.com/bldragon101/worklog/commit/daf05da9a222bd97cd38dd5604c5b8c0f273fcfb))

## [1.3.0-pre.4](https://github.com/bldragon101/worklog/compare/v1.3.0-pre.3...v1.3.0-pre.4) (2025-11-17)

### Features

* Add RCTI Deductions API validation tests ([a4ed721](https://github.com/bldragon101/worklog/commit/a4ed721eaa3170e1d56184aa3ed21e2e21547f95))
* Update Clerk public metadata only on role change ([d864f07](https://github.com/bldragon101/worklog/commit/d864f076d3fbf56226becfa70ce7cb4bb91a4b5e))
* Use transaction and optimistic lock for deductions ([26666bf](https://github.com/bldragon101/worklog/commit/26666bf0d8691be2138160dd4f648f3a8dbada5a))

### Bug Fixes

* Add permission check and include rate-limit headers ([2c5a33c](https://github.com/bldragon101/worklog/commit/2c5a33c82711998f4e0dce4700eb967136eb2a5a))
* Add Prisma enums for GST and status fields ([e90bbb0](https://github.com/bldragon101/worklog/commit/e90bbb0ec9b9ff41985fbd64d3e0de4838dac061))
* Convert monetary fields to Decimal and adapt code ([0722755](https://github.com/bldragon101/worklog/commit/0722755e229b350c1da35a2427db8ba129cf1f17))
* Convert RCTI numeric fields using toNumber ([731415e](https://github.com/bldragon101/worklog/commit/731415ee74a6b635f92e8a28d10b3f4992fdfd48))
* Fix PDF template types and data mapping ([e1b05c7](https://github.com/bldragon101/worklog/commit/e1b05c78b6ebf8a50b508cd28f438d5abb63f09a))
* Fix RCTI PDF types and revert version bump ([a1b8030](https://github.com/bldragon101/worklog/commit/a1b803090712d8bbe61ab51016625f6c80502871))
* Fix SSR logo comment; memoize permission check ([e1a0f1a](https://github.com/bldragon101/worklog/commit/e1a0f1acb4f189f93dfe8075e174a7734dd1d723))
* Normalize optional fields and update selectively ([82b8ad0](https://github.com/bldragon101/worklog/commit/82b8ad0b238fe426308b9342eca904fca85289b5))
* Reset mocks for each image test case ([58182a1](https://github.com/bldragon101/worklog/commit/58182a17380d8e7280574d3e6eee8a4af86e6380))
* Restrict finalised/paid status and GST edits Reject direct PATCH ([f8c1f95](https://github.com/bldragon101/worklog/commit/f8c1f959862ffdcc31ba1330d2d77961fda03553))
* Update changelog for v1.3.0 release ([f6186d3](https://github.com/bldragon101/worklog/commit/f6186d333f198d5f817bec8f2e73cb46619be13c))
* Use actual rcti-calculations module in tests ([de7433e](https://github.com/bldragon101/worklog/commit/de7433ea6fe771f9bf724f276cc8d82f3540bf9a))
* Use hierarchical role ranks in ProtectedRoute Replace explicit ([7e3d848](https://github.com/bldragon101/worklog/commit/7e3d8487892a1ed6be3266ba17b1aa6d6162de2f))
* Validate and parse driverId and date inputs ([beb433f](https://github.com/bldragon101/worklog/commit/beb433fbb432dad581479f5e9bb0b4ed70ee4c8e))
* Validate job IDs and add rate-limit headers ([c01ce18](https://github.com/bldragon101/worklog/commit/c01ce186f229851ae3e57594cababcb57ac30bac))
* Validate RCTI and Line IDs are positive ([f5f5012](https://github.com/bldragon101/worklog/commit/f5f501246b16403447e79397ea529816f683bcbf))

## [1.3.0-pre.3](https://github.com/bldragon101/worklog/compare/v1.3.0-pre.2...v1.3.0-pre.3) (2025-11-15)

### Features

* Use pnpx for Prisma and add 1.3.0 notes ([e36993e](https://github.com/bldragon101/worklog/commit/e36993eac13d7cca2a144e8421aee0fb58a04eef))

## [1.3.0-pre.2](https://github.com/bldragon101/worklog/compare/v1.3.0-pre.1...v1.3.0-pre.2) (2025-11-15)

### Features

* Add multi-driver selection and batch RCTI ([634a7ad](https://github.com/bldragon101/worklog/commit/634a7adc4e4e926416b18f4bf8e9bc89f1317358))
* Add payroll page, sidebar and permissions ([9fc5c9f](https://github.com/bldragon101/worklog/commit/9fc5c9f350d60deb6631b1bb63d1b85135230f08))
* Add RCTI break, toll and fuel levy logic ([1805d98](https://github.com/bldragon101/worklog/commit/1805d9858af1d44b9b6f21d1f17e9bfa9b744186))
* Add RCTI feature ([5924259](https://github.com/bldragon101/worklog/commit/592425932cce95f02abed8ce48b25f7646c61585))
* Add RCTI feature with deductions and migrations ([5c59f49](https://github.com/bldragon101/worklog/commit/5c59f49eb7232bb6078b90d237d9f509da2b71f6))
* Add RCTI manual lines tests ([07ff030](https://github.com/bldragon101/worklog/commit/07ff030e5fab397669402431c5882fc1df000136))
* Add RCTI refresh, line deletion, and filters ([c8ef529](https://github.com/bldragon101/worklog/commit/c8ef5298006d72e4742b57d1debfa65525fb3921))
* Add RCTI settings and PDF export ([8342ee3](https://github.com/bldragon101/worklog/commit/8342ee3562f81cb201a3ceab542c8d01bf71dab7))
* Add Suspense to OverviewPage and RCTI tests ([6854444](https://github.com/bldragon101/worklog/commit/6854444731b3c8ab0a5673d89e65b6084b8f8c5b))
* Bump dependencies and fix auth session ([fea1795](https://github.com/bldragon101/worklog/commit/fea17956f92d477e36f8247ac054cafe090a7031))
* Convert project configs to TypeScript ([d5990e6](https://github.com/bldragon101/worklog/commit/d5990e68a7ca9be27f35f4943cbf68927cdf01bb))
* delete redundant tests ([b52433c](https://github.com/bldragon101/worklog/commit/b52433cd7a6a8974a53e04eef83074259d4722ae))
* Include businessName in RCTI PDF template ([3a8fb67](https://github.com/bldragon101/worklog/commit/3a8fb67bf12a16a754c3913937b2df8975ed66ed))
* Introduce PermissionsProvider to centralize role and permission ([46fe866](https://github.com/bldragon101/worklog/commit/46fe8668bc06227e93e8eca78444b294e21d365a))
* Refactor RCTI calculations and user APIs ([e9f8c07](https://github.com/bldragon101/worklog/commit/e9f8c07db9e898372a620f690237dd58c1ef9ea1))
* Sync user roles to Clerk and add route guards ([435ae7f](https://github.com/bldragon101/worklog/commit/435ae7fdf209db735aa14b8d480e9a257a9536cc))

### Bug Fixes

* Add businessName support and RCTI settings ([151889e](https://github.com/bldragon101/worklog/commit/151889ee76effc97efd1668fdff6cc719d3542f3))
* Add type annotation to resolve TypeScript error in RCTI page ([14e813f](https://github.com/bldragon101/worklog/commit/14e813fc5956c20b91c5b943a85fcdef3dedc4db))
* Convert RCTI integration tests to unit tests ([0f08898](https://github.com/bldragon101/worklog/commit/0f088980b65c4f87b30fb87277fa6eb1dec2e675))
* Extract Job-to-RCTI helpers and totals ([cb8d64d](https://github.com/bldragon101/worklog/commit/cb8d64d97a6be2f37ac7e5091181ebe1427f2047))
* Fix login redirect, validation, and break grouping ([8dbf7fa](https://github.com/bldragon101/worklog/commit/8dbf7fac530618b0aad045ad935bce90e55da0d8))
* Fix request body handling in settings tests ([ddad617](https://github.com/bldragon101/worklog/commit/ddad61733d698319d348348abf0779a15c892834))
* Refactor tests, add mocks/providers, fix nav map ([429de47](https://github.com/bldragon101/worklog/commit/429de47044fc4599304b94f603e4d10113cb5786))
* Strip spaces and dashes from ABN and BSB ([390baf6](https://github.com/bldragon101/worklog/commit/390baf655e54a802787af9c5b2c4068150f49841))
* Use exported MAX_FUTURE_YEAR_OFFSET for year validation ([d51b5bc](https://github.com/bldragon101/worklog/commit/d51b5bc94f612047949d0c3427d4256ac89cbb3d))
* Validate RCTI lines and show empty state ([3c92010](https://github.com/bldragon101/worklog/commit/3c92010f1d5c3a6026bb41da620e18889f441078))

## [1.3.0-pre.1](https://github.com/bldragon101/worklog/compare/v1.2.0...v1.3.0-pre.1) (2025-10-29)

### Features

* Add customizable pagination and jobs stats UI ([3b254a0](https://github.com/bldragon101/worklog/commit/3b254a0604cf9b9311fdf9367c920ea6a6df8bf5))
* Add JobsStatsBar tests and simplify memoization ([23c381e](https://github.com/bldragon101/worklog/commit/23c381ea6e2d247f96ce4b1257f561c7b3727fe1))
* Compute job stats reactively and remove manual refresh ([9a29b31](https://github.com/bldragon101/worklog/commit/9a29b31dcc45ac32edffb9302675124e7466f198))
* Remove Claude GitHub workflows ([ea09ff4](https://github.com/bldragon101/worklog/commit/ea09ff4f3386fd9826974110c6eacaf6c8fa848b))

### Bug Fixes

* Debounce global search and use in toolbar ([457148b](https://github.com/bldragon101/worklog/commit/457148bc84f59d59c16820c1699bcc3997a757e7))
* Fix truck type categorization and hours formatting Use ([aa53658](https://github.com/bldragon101/worklog/commit/aa5365862f3366ea8eddc7e712542438aad9c0a1))
* remove sorting from columns that dont require it ([fecad04](https://github.com/bldragon101/worklog/commit/fecad04180c9f267b33c2a96fe61418c118ce3c4))
* Update tests to expect two-decimal hours format ([4298c33](https://github.com/bldragon101/worklog/commit/4298c3334d7bb5fc0e054f1979876cbcc367dfa9))

### Chores

* Bump dependencies and update changelog to v1.2.0 ([b237cd6](https://github.com/bldragon101/worklog/commit/b237cd679182048dbdc327e257b71c26b715b1bd))

## [1.2.0](https://github.com/bldragon101/worklog/compare/v1.1.0...v1.2.0) (2025-10-01)

### Features

* Add changelog API and sidebar version dialog ([f3c756a](https://github.com/bldragon101/worklog/commit/f3c756a86d0246bfed9c67380a2e51ac66c4a91b))
* Add changelog JSON generation and API refactor - Generate ([418594c](https://github.com/bldragon101/worklog/commit/418594ca6980eccfeac27d1692214fb3ee2fa610))
* Add copy job details feature to data table sheet Includes a dialog ([339b185](https://github.com/bldragon101/worklog/commit/339b1852bdfbf6582e1e2901d0502f2c7b53e982))
* add option to copy job details to paste in external page ([5c3fbe2](https://github.com/bldragon101/worklog/commit/5c3fbe2aeca67cd1f104dbc98bb679862fe5b7f4))
* Add release notes for v1.2.0 and improve data table features ([acea106](https://github.com/bldragon101/worklog/commit/acea1069deb7d7c0e3d144eb4432aec3fdd1394d))
* Add security and validation to changelog generation and API - ([dc22eb3](https://github.com/bldragon101/worklog/commit/dc22eb3eaeb0adda65ad90b089b1b52082cc9533))
* Improve changelog API error handling and test coverage ([9e47547](https://github.com/bldragon101/worklog/commit/9e4754799e85de30d4bf20d4b0788aaef3a818bc))
* Refactor changelog parsing and add changelog dialog tests ([e4e342d](https://github.com/bldragon101/worklog/commit/e4e342da84be62020e3454bf468ba3bf1406d9d2))
* Refactor changelog to support commit links and URLs ([a0c7352](https://github.com/bldragon101/worklog/commit/a0c7352b2364db8cf9e0c94a76ed00267038fd11))
* Show user-friendly release notes in changelog dialog ([88155d5](https://github.com/bldragon101/worklog/commit/88155d5b7cdd402e7b33f51ce3255132ba34791f))
* Update dependencies and improve Job copy details logic - Updated ([35c7004](https://github.com/bldragon101/worklog/commit/35c70042998410ea4201525de18e9c9c5a560379))

### Bug Fixes

* Add dynamic CSP nonce and security headers via middleware ([9accc99](https://github.com/bldragon101/worklog/commit/9accc9957e1bf4423b460cb996ddb164f34f00a3))
* Fix job details formatting and timezone handling ([f8fc237](https://github.com/bldragon101/worklog/commit/f8fc237b4ad10d4f962233815a9c92469471b8d2))
* Fix job duplication util and update test mocks for type safety ([a02bee9](https://github.com/bldragon101/worklog/commit/a02bee96baeb4fa0bc6679f5a89fefd9d4b06104))
* Refactor changelog API tests and add security header checks ([fe5e442](https://github.com/bldragon101/worklog/commit/fe5e4422e92d291fc7479e83ac3bf0dab8e862f9))
* Refactor changelog items to use object format with text field ([d6c5d1e](https://github.com/bldragon101/worklog/commit/d6c5d1ed3c2d24994a4d7a874b62e2854612e622))
* Refactor changelog tests to use pre-generated release data Update ([8406d5c](https://github.com/bldragon101/worklog/commit/8406d5cf1dacf11ce54a99e9f32c0ae3c8cb8198))
* Refactor changelog types and remove unused auth import - Simplify ([706fd08](https://github.com/bldragon101/worklog/commit/706fd08297cf4cff6b597605034b8b6520da1641))
* Refactor loading skeletons and spinners for consistency - Replace ([e4b174b](https://github.com/bldragon101/worklog/commit/e4b174bf30124b15c233abecb7c06e79ac612f4f))
* Remove @next/font dependency as it is not used ([b3fdec1](https://github.com/bldragon101/worklog/commit/b3fdec1855f938d107351a2ffb2bbd67e38c93fc))
* Use extractTimeFromISO for job time formatting ([19061ce](https://github.com/bldragon101/worklog/commit/19061ce44806baef10d31e2739f3131b3e1de8ec))

### Reverts

* Remove CSP/nonce implementation ([27aa741](https://github.com/bldragon101/worklog/commit/27aa741f6943fc85bd64ac85528558bb06eea3ca))

### Chores

* **release:** 1.2.0-pre.1 [skip ci] ([aeffdd0](https://github.com/bldragon101/worklog/commit/aeffdd0b10673271383fa5ac716fbcc55e1188cb))
* **release:** 1.2.0-pre.2 [skip ci] ([3dd51e1](https://github.com/bldragon101/worklog/commit/3dd51e108c3dee078d0494d5f4319e9f412842d1))
* **release:** 1.2.0-pre.3 [skip ci] ([7180e3a](https://github.com/bldragon101/worklog/commit/7180e3a4994f7e9b5e2bff2395b39a1d95997a1e))
* Update dependencies and lockfile ([f80286f](https://github.com/bldragon101/worklog/commit/f80286fda42e35459c76f0ca7f3fca2110fdcf47))
* update gitignore ([c822fc7](https://github.com/bldragon101/worklog/commit/c822fc713281d3ec54ddffdf342e2fce3aefc6fa))

## [1.2.0-pre.3](https://github.com/bldragon101/worklog/compare/v1.2.0-pre.2...v1.2.0-pre.3) (2025-10-01)

### Bug Fixes

* Use extractTimeFromISO for job time formatting ([19061ce](https://github.com/bldragon101/worklog/commit/19061ce44806baef10d31e2739f3131b3e1de8ec))

## [1.2.0-pre.2](https://github.com/bldragon101/worklog/compare/v1.2.0-pre.1...v1.2.0-pre.2) (2025-10-01)

### Features

* Add copy job details feature to data table sheet Includes a dialog ([339b185](https://github.com/bldragon101/worklog/commit/339b1852bdfbf6582e1e2901d0502f2c7b53e982))
* add option to copy job details to paste in external page ([5c3fbe2](https://github.com/bldragon101/worklog/commit/5c3fbe2aeca67cd1f104dbc98bb679862fe5b7f4))
* Add release notes for v1.2.0 and improve data table features ([acea106](https://github.com/bldragon101/worklog/commit/acea1069deb7d7c0e3d144eb4432aec3fdd1394d))
* Update dependencies and improve Job copy details logic - Updated ([35c7004](https://github.com/bldragon101/worklog/commit/35c70042998410ea4201525de18e9c9c5a560379))

### Bug Fixes

* Fix job details formatting and timezone handling ([f8fc237](https://github.com/bldragon101/worklog/commit/f8fc237b4ad10d4f962233815a9c92469471b8d2))

## [1.2.0-pre.1](https://github.com/bldragon101/worklog/compare/v1.1.0...v1.2.0-pre.1) (2025-09-28)

### Features

* Add changelog API and sidebar version dialog ([f3c756a](https://github.com/bldragon101/worklog/commit/f3c756a86d0246bfed9c67380a2e51ac66c4a91b))
* Add changelog JSON generation and API refactor - Generate ([418594c](https://github.com/bldragon101/worklog/commit/418594ca6980eccfeac27d1692214fb3ee2fa610))
* Add security and validation to changelog generation and API - ([dc22eb3](https://github.com/bldragon101/worklog/commit/dc22eb3eaeb0adda65ad90b089b1b52082cc9533))
* Improve changelog API error handling and test coverage ([9e47547](https://github.com/bldragon101/worklog/commit/9e4754799e85de30d4bf20d4b0788aaef3a818bc))
* Refactor changelog parsing and add changelog dialog tests ([e4e342d](https://github.com/bldragon101/worklog/commit/e4e342da84be62020e3454bf468ba3bf1406d9d2))
* Refactor changelog to support commit links and URLs ([a0c7352](https://github.com/bldragon101/worklog/commit/a0c7352b2364db8cf9e0c94a76ed00267038fd11))
* Show user-friendly release notes in changelog dialog ([88155d5](https://github.com/bldragon101/worklog/commit/88155d5b7cdd402e7b33f51ce3255132ba34791f))

### Bug Fixes

* Add dynamic CSP nonce and security headers via middleware ([9accc99](https://github.com/bldragon101/worklog/commit/9accc9957e1bf4423b460cb996ddb164f34f00a3))
* Fix job duplication util and update test mocks for type safety ([a02bee9](https://github.com/bldragon101/worklog/commit/a02bee96baeb4fa0bc6679f5a89fefd9d4b06104))
* Refactor changelog API tests and add security header checks ([fe5e442](https://github.com/bldragon101/worklog/commit/fe5e4422e92d291fc7479e83ac3bf0dab8e862f9))
* Refactor changelog items to use object format with text field ([d6c5d1e](https://github.com/bldragon101/worklog/commit/d6c5d1ed3c2d24994a4d7a874b62e2854612e622))
* Refactor changelog tests to use pre-generated release data Update ([8406d5c](https://github.com/bldragon101/worklog/commit/8406d5cf1dacf11ce54a99e9f32c0ae3c8cb8198))
* Refactor changelog types and remove unused auth import - Simplify ([706fd08](https://github.com/bldragon101/worklog/commit/706fd08297cf4cff6b597605034b8b6520da1641))
* Refactor loading skeletons and spinners for consistency - Replace ([e4b174b](https://github.com/bldragon101/worklog/commit/e4b174bf30124b15c233abecb7c06e79ac612f4f))
* Remove @next/font dependency as it is not used ([b3fdec1](https://github.com/bldragon101/worklog/commit/b3fdec1855f938d107351a2ffb2bbd67e38c93fc))

### Reverts

* Remove CSP/nonce implementation ([27aa741](https://github.com/bldragon101/worklog/commit/27aa741f6943fc85bd64ac85528558bb06eea3ca))

### Chores

* Update dependencies and lockfile ([f80286f](https://github.com/bldragon101/worklog/commit/f80286fda42e35459c76f0ca7f3fca2110fdcf47))
* update gitignore ([c822fc7](https://github.com/bldragon101/worklog/commit/c822fc713281d3ec54ddffdf342e2fce3aefc6fa))

## [1.1.0](https://github.com/bldragon101/worklog/compare/v1.0.0...v1.1.0) (2025-09-23)

### Features

* Add comprehensive tests for job duplication edge cases ([709bee8](https://github.com/bldragon101/worklog/commit/709bee84509dbdc84e448c489ee1f91802cac31e))
* add workflows for release management and changelogs ([6d247e3](https://github.com/bldragon101/worklog/commit/6d247e3448643ac034c1825632fc8a8f792dc315))
* Replace CLAUDE.md with AGENTS.md as AI agent guide ([d934fe6](https://github.com/bldragon101/worklog/commit/d934fe66ebe024c5b6924d279adb006b2f7eceea))

### Bug Fixes

* improve job duplication feature with proper state management ([bd8f5d4](https://github.com/bldragon101/worklog/commit/bd8f5d4b153b2f2d41200e29dc935b0c2ae8e3c1))
* proper semantic versioning for releases ([ddd5fce](https://github.com/bldragon101/worklog/commit/ddd5fce42693cc79b02517da4ce96c6466e8bce8))
* Set dropoff to empty string and add attachment arrays in test ([6dab09e](https://github.com/bldragon101/worklog/commit/6dab09e069016649d1f7db877411c446d6ac0139))
* Simplify job duplication by removing redundant field cleanup ([e6ebf7d](https://github.com/bldragon101/worklog/commit/e6ebf7df86592ccba28149ef0d8db66bfc169713))
* standardise release workflows ([060f0b7](https://github.com/bldragon101/worklog/commit/060f0b78c45b6ab7f53117ed40a48aa18d190631))

### Chores

* **release:** 1.1.0-pre.1 [skip ci] ([ccd223e](https://github.com/bldragon101/worklog/commit/ccd223e7c1b831915a1f08259577d23a90e0aa36))
* **release:** 1.1.0-pre.2 [skip ci] ([5a120da](https://github.com/bldragon101/worklog/commit/5a120da750c86a94b3a4d3b2e67befc0b6d65338))

## [1.1.0-pre.2](https://github.com/bldragon101/worklog/compare/v1.1.0-pre.1...v1.1.0-pre.2) (2025-09-23)

### Features

* Add comprehensive tests for job duplication edge cases ([709bee8](https://github.com/bldragon101/worklog/commit/709bee84509dbdc84e448c489ee1f91802cac31e))
* Replace CLAUDE.md with AGENTS.md as AI agent guide ([d934fe6](https://github.com/bldragon101/worklog/commit/d934fe66ebe024c5b6924d279adb006b2f7eceea))

### Bug Fixes

* improve job duplication feature with proper state management ([bd8f5d4](https://github.com/bldragon101/worklog/commit/bd8f5d4b153b2f2d41200e29dc935b0c2ae8e3c1))
* proper semantic versioning for releases ([ddd5fce](https://github.com/bldragon101/worklog/commit/ddd5fce42693cc79b02517da4ce96c6466e8bce8))
* Set dropoff to empty string and add attachment arrays in test ([6dab09e](https://github.com/bldragon101/worklog/commit/6dab09e069016649d1f7db877411c446d6ac0139))
* Simplify job duplication by removing redundant field cleanup ([e6ebf7d](https://github.com/bldragon101/worklog/commit/e6ebf7df86592ccba28149ef0d8db66bfc169713))

## [1.1.0-pre.1](https://github.com/bldragon101/worklog/compare/v1.0.0...v1.1.0-pre.1) (2025-09-19)

### Features

* add workflows for release management and changelogs ([6d247e3](https://github.com/bldragon101/worklog/commit/6d247e3448643ac034c1825632fc8a8f792dc315))

### Bug Fixes

* standardise release workflows ([060f0b7](https://github.com/bldragon101/worklog/commit/060f0b78c45b6ab7f53117ed40a48aa18d190631))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of WorkLog application
- Customer management system
- Job tracking with time management
- Work log entries
- Authentication with Clerk
- CSV import/export functionality
- Google Drive integration
- Mobile responsive design
- Dark/light theme support
- Advanced filtering capabilities

## [1.0.0] - 2025-08-18

### Added
- Initial release with core functionality
- See release notes for full feature list
