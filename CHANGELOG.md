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

### Contributed ISIRs Changes

- Organized contributed ISIRs into folders with a README explanation of their intended use.

## 2024-02-23

### Test ISIRs Changes

- For the 8 published test ISIRs, updated field 212 _College Grant and Scholarship Aid_ for scenario #5 _Connor Ryan Hudson_ to a value of `1000` (previously `0`). Cause: transcription error.
- For the 8 published test ISIRs, updated field 903. Cause: transcription error.
    - for scenario #6 to `3` for "Married-Filed Separate Return" (previously `4`).
    - for scenario #7 to `2` for "Married-Filed Joint Return" (previously `3`).
- For scenario #3 (last name "Grainberry"), changed field 862 Returned tax year to `2022` and field 881 to `206` IRS response code to illustrate an example of why this application did not have FTI data. Cause: feedback request for clarification
- For the 8 published test ISIRs, updated various blank fields with `0` for clarity.

### Code Changes

- Updated `isir-module.js` with additional validations.
    - SSN specific validation for length and lexographic range
    - validate that fields are left-aligned 
    - validate which fields can be blank
    - changed UUID fields to validate as alphanumeric to spec, parse as UUID when formatted as such
    - turned comment code field into a list and validate values
    - validate and parse correction fields
    - validate and list NSLDS Postscreaning Reason Code field
- Updated `isir-viewer.html` with UI improvements and updated `isir-module.js`
    - changed the embedded sample ISIRs to be the published 8 test ISIRs in this repo
    - expanded UI details for field validation issues (such as field left alignment)
    - UI improvements
- Updated `isir-spreadsheet.html` with UI improvements and updated `isir-module.js`
    - Added flexibility for field 581 for booleans from Excel spreadsheet
    - Expanded UI details for field validation issues (such as field left alignment)
    - UI improvements
 
## 2024-03-01

### Test ISIRs Changes

- Added a new system-generated test ISIR file to the [test-isir-files folder](/test-isir-files).
