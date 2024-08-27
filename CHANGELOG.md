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


## 2024-03-06

### Code Changes

- Updated `isir-module.js` from [2024-25 FAFSA Specification Guide (March 2024 Update #2)](https://fsapartners.ed.gov/knowledge-center/library/handbooks-manuals-or-guides/2023-05-31/2024-25-fafsa-specifications-guide-march-2024-update-2). These updates are also incorporated into `isir-viewer.html` and `isir-from-spreadsheet.html`.
    - Minimum for _Parent Contribution_ field 312 set to `-1500` (previously `0`)
    - `Blank` removed as valid option from Student birthdate for field 29
    - `Blank` added as valid option for field 581 _Use User Provided Data Only_
    - `Blank` added as valid option for NSLDS Loan Change Flag fields 723, 746, 769, 792, 815, and 838
    - `Blank` added as valid option for FTI fields 861, 881, and 942
    - added `"FC"` to lookup for valid State Codes per header in Table 4-4 of the ISIR Layout specification guide.
    - added `.raw` field value alongside trimmed `.value` to `isir_field_validate()` result


## 2024-03-09

### Test ISIRs Changes

- Added the updated [system-generated ISIR file](https://fsapartners.ed.gov/knowledge-center/library/handbooks-manuals-or-guides/2023-05-31/2024-25-fafsa-specifications-guide-march-2024-update) to the [test-isir-files folder](/test-isir-files). Changes to the file are outlined in the March 8th updates on the [2024–25 FAFSA Updates page](https://fsapartners.ed.gov/knowledge-center/topics/fafsa-simplification-information/2024-25-fafsa-updates#pid_1399062) on the FSA Knowledge Center.


## 2024-04-03

### Added Tools
- Added [`fafsa-uuid-search.html`](./fafsa-uuid/fafsa-uuid-search.html) to allow searching a CSV file of up to 10 million UUIDs.


## 2024-04-04

### Code Changes

- Updated fafsa-uuid-search.html
    - Added functionality to upload a custom CSV of FAFSA UUIDs to compare against the Department-provided CSVs. This functionality provides search results showing matches and non-matches along with the ability to export a CSV of the results.
    - UI improvements

## 2024-08-27

### Added Tools

- Added [isir-split-by-college.html](./isir-split-by-college.html) to generate an ISIR file that includes only selected College codes.

