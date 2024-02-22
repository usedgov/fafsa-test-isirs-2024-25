# Changelog

All notable changes to this project will be documented in this file.

## 2024-02-16

Initial release of project supporting ISIR Layout specification released today, February 16th, 2024.

### Test ISIRs Changes

- Updated field 297, position 2812, to `"N"` for 8 published test ISIRs, per specification requirement.

### Code Changes

- Added record position to ISIR field tables in `isir-viewer.html` and `isir-from-spreadsheet.html`

## 2024-02-19

### Contributed ISIRs Changes

- A contributor added files intended to assist testing systems using progressively larger batches of ISIRs.

## 2024-02-21

### Test ISIRs Changes

- Created an additional version of the original September 2023 test ISIRs, in which we removed left-padding, added a value of `False` to field 581, and added the SAIG header & trailer.
- For the 8 published test ISIRs, updated field 171 of scenario #4 and field 227 for scenario #7, restoring leading `0` to SSNs. Cause: Excel interpretation as number and trimming leading `0`s; not validating SSNs have full 9 digits. Source: external PR #11
- For the 8 published test ISIRs, updated field 212 _College Grant and Scholarship Aid_ for scenario #5 _Connor Ryan Hudson_ to a value of `1000` (previously `0`). Cause: transcription error.

### Contributed ISIRs Changes

- Organized contributed ISIRs into folders with a README explanation of their intended use.

## 2024-02-22

### Test ISIRs Changes

- For the 8 published test ISIRs, updated field 903 for scenario #6 to `3` for "Married-Filed Separate Return" (previously `4`). Updated field 903 for scenario #6 to `2` for "Married-Filed Joint Return" (previously `3`). Cause: Excel transcription error.
