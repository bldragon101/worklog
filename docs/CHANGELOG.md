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
