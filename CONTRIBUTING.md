# How to Contribute

We're so thankful you're considering contributing to an [open source project of
the U.S. government](https://code.gov/)! If you're unsure about anything, just
ask -- or submit the issue or pull request anyway. The worst that can happen is
you'll be politely asked to change something. We appreciate all friendly
contributions.

We encourage you to read this project's CONTRIBUTING policy (you are here), its
[LICENSE](LICENSE.md), and its [README](README.md).


## Getting Started

### Entrypoints of [`code/isir-module.js`](./code/isir-module.js)

```javascript
// Load all ISIR fields by section from an ISIR frame, performing validation
//   isir_load_report(my_sample_isir_frame)
export function isir_load_report(isir_frame, opt) {}
//   isir_section_report(section_student_identity, my_sample_isir_frame)
export function isir_section_report(section, isir_frame, opt={}) {}

// Load all ISIR fields into structured JSON from an ISIR frame, performing validation
//   isir_load_json(my_sample_isir_frame)
export function isir_load_json(isir_frame, opt) {}
//   isir_section_json(section_student_identity, my_sample_isir_frame)
export function isir_section_json(section, isir_frame, opt={}) {}


// Extract field value from ISIR frame using field validation
//   isir_field_read(field_4, my_sample_isir_frame)
export function isir_field_read(field, isir_frame, mode) {}

// Validate value using field specific logic.
//   isir_field_validate(field_4, 'My new Person UUID')
export function isir_field_validate(field, value, mode) {}

// Given an existing ISIR record frame,
// Update field value and return a new ISIR record frame
//   isir_field_update(field_4, my_sample_isir_frame, 'My new Person UUID')
export function isir_field_update(field, isir_frame, value) {}

// Return a new blank ISIR frame using field definitions
//   let my_new_isir = isir_blank()
export function isir_blank() {}
```

## Approach & Design

Using the sections and fields detailed in the [2024–25 Final ISIR Record Layout in Excel Format][vol_4_spec_xlsx], 
the JavaScript source of [`./isir-module.js`](./isir-module.js) is automatically generated for every field.

Each ISIR record field is specified by start postion, stop position, and length, as well as notes on how to interpret the data specific to each field. 
Note that the specification uses a `1`-based position offset, whereas JavaScript uses a zero based index.

The [`./isir-module.js`](./isir-module.js) module is a copy of the generated JavaScript module from the Excel specification.
The module is then embedded in [`isir-viewer.html`](../isir-viewer.html) and [`isir-from-spreadsheet.html`](../isir-from-spreadsheet.html) 
for reading and updating individual ISIR fields.

### ISIR technical specification for FAFSA 2024-2025
Using published [Draft 2024-25 FAFSA Specifications Guide (February 2024 Update)][full_spec] specification, 
_Volume 4 – Record Layouts and Processing Codes_, [2024–25 Final ISIR Record Layout in Excel Format][vol_4_spec_xlsx]

  [vol_4_spec_xlsx]: https://fsapartners.ed.gov/sites/default/files/2023-11/2024-25ISIRNov2023.xlsx
  [full_spec]: https://fsapartners.ed.gov/knowledge-center/library/handbooks-manuals-or-guides/2023-05-31/draft-2024-25-fafsa-specifications-guide-february-2024-update

### Building dependencies

This project sources dependencies directly from CDNs.


### Building the Project

This project has no build or compilation steps.


### Workflow and Branching

We follow the [GitHub Flow Workflow](https://guides.github.com/introduction/flow/)

1.  Fork the project
1.  Check out the `main` branch
1.  Create a feature branch
1.  Write code and tests for your change
1.  From your branch, make a pull request against this repo.
1.  Work with repo maintainers to get your change reviewed
1.  Wait for your change to be pulled into this repo.
1.  Delete your feature branch 


## Security and Responsible Disclosure Policy
Refer to the [Department of Education Vulnerability Disclosure Policy](https://www.ed.gov/vulnerability-disclosure-policy)

## Public domain

This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).

All contributions to this project will be released under the CC0 dedication. By submitting a pull request or issue, you are agreeing to comply with this waiver of copyright interest.
