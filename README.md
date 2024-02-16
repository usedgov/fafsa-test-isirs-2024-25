## **FAFSA Test ISIRs 2024-25**
Test ISIRs for the 2024-25 FAFSA Award Year with standalone tools to view and validate ISIRs and to assist with creating mock data for test ISIRs.

## About the Project
This project is a collaboration between the Department of Education, Federal Student Aid, and the U.S. Digital Service.

Our goal is to accelerate the successful processing of Institutional Student Information Records (ISIRs) for the 2024-25 FAFSA Award Year by our partners in higher education.  

This repository holds test ISIRs and tools to help colleges, third-party servicers, and software vendors prepare to package students’ financial aid as quickly and accurately as possible. The actual 2024-25 FAFSA student and parent application is on [studentaid.gov](https://studentaid.gov/h/apply-for-aid/fafsa).

### ISIR technical specification for FAFSA 2024-2025
The test ISIRs and tools have been created using the following specifications:
- [Draft 2024-25 FAFSA Specifications Guide, December 2023 Update #2][spec]
    - _Volume 4 – Record Layouts and Processing Codes_
        - [2024–25 Final ISIR Record Layout in Excel Format, 96KB](https://fsapartners.ed.gov/sites/default/files/2023-11/2024-25ISIRNov2023.xlsx)

[spec]: https://fsapartners.ed.gov/knowledge-center/library/handbooks-manuals-or-guides/2023-05-31/draft-2024-25-fafsa-specifications-guide-december-2023-update-2

## Getting Started

### Test ISIRs
The FSA-provided test ISIR files are available in [the test ISIR folder](./test-isir-files/). They can be downloaded directly from there.

Community-contributed test ISIR files are available in [the contributed ISIR folder](./contributed-isir-files/). This is also the location where you can submit your test ISIRs to share with the community. Instructions are provided in that folder.

### Tools
The following tools are currently available. These tools have limited ongoing support. Additional tools and updates to existing tools will be published as they become available. 

To download a tool: select the file, and on the resulting page click the "Download raw file" button in the upper right menu.

**[`isir-viewer.html`](./isir-viewer.html)**  
This standalone tool can intake a file of ISIRs with `.dat` or `.txt` extension, conduct light field-level validation, export the data as an Excel spreadsheet, and display both the ISIR data and validation results in a simple browser-based user interface.
1. Download the [`isir-viewer.html`](./isir-viewer.html) file.
2. Open `isir-viewer.html` in a browser (Google Chrome or Microsoft Edge preferred).
3. Three sample ISIRs from 9/28/2023 are pre-loaded into the tool. You can view each ISIR using the "Select sample ISIR" menu item.
4. You may also load test ISIRs with `.dat` or `.txt` extensions using the "Select ISIR sample file" menu item.
5. Field-level validation results and a presentation of the ISIR fields are displayed. Data is divided into different expandable sections.
6. To export an Excel (`.xlsx`) spreadsheet of ISIR data, choose "Current" or "All" under the "Spreadsheet from ISIR" menu item. "Current" will export the currently displayed sample ISIR; "All" will export every ISIR in your currently loaded sample file into one sheet with multiple columns. Clicking on the resulting filename that appears will download the Excel spreadsheet.

**[`isir-from-spreadsheet.html`](./isir-from-spreadsheet.html)**  
This standalone tool can ingest an Excel spreadsheet and provide ISIRs in text (`.txt`) and JSON formats.
1. Download the [`isir-from-spreadsheet.html`](./isir-from-spreadsheet.html) file.
2. Open `isir-from-spreadsheet.html` in a browser (Google Chrome or Microsoft Edge preferred).
3. Use the "Choose File" button to load an Excel (`.xlsx`) spreadsheet. You can choose to change the default ISIR header/trailer option prior to loading your sheet. A spreadsheet to use as a "template" for test data can be exported using the pre-loaded ISIRs in the `isir-viewer.html` tool.
4. Once a spreadsheet is loaded, field-level validation results and a presentation of the ISIR fields from the first ISIR in the spreadsheet is displayed. You can view each ISIR from your spreadsheet using the "Select sample ISIR" menu item.
5. The "Output" area displays links to text ISIRs with a `.txt` extension. You can choose to download your sample ISIRs altogether in one file or in individual files.
6. There is also a link to download the ISIRs as a JSON file, which can be used when reviewing ISIR fields as read by `isir-module.js`.

**[`mock-isir-information.html`](./mock-isir-information.html)**  
This standalone tool generates mock data that can be used when hand-generating test ISIRs.
1. Download the [`mock-isir-information.html`](./mock-isir-information.html) file.
2. Open `mock-isir-information.html` in a browser (Google Chrome or Microsoft Edge preferred).
3. Mock information is displayed and available to be copied. The mock information is formatted to be easily pasted into the corresponding fields in an Excel (`.xlsx`) spreadsheet as generated from the `isir-viewer.html` tool.
4. New mock data can be generated by clicking the "Regenerate" button or by refreshing the browser page.

**[`isir-module.js`](./code/isir-module.js)**  
This JavaScript module is used for field-level validation in both `isir-viewer.html` and `isir-from-spreadsheet.html`. It is not necessary to download this file in order to run any of the provided tools; it is provided to give visibility into how the field-level validation works. This file is available for download at [`code/isir-module.js`](./code/isir-module.js). 

## Contact Us
We welcome our partners to continue to submit questions related to the 2024-25 FAFSA launch, including questions or comments about the FSA-developed additional test ISIRs and open-source tools, using the [Contact Customer Support form](https://fsapartners.ed.gov/help-center/contact-customer-support) in FSA’s Partner Connect Help Center. To submit a question, please enter your name, email address, topic, and question. When submitting a question related to this Electronic Announcement, please select the topic “2024-25 FAFSA.” 

We are unable to respond to questions about community-contributed test ISIRs that are accepted into this repository.

## Contributing
Thank you for considering contributing to an Open Source project of the US Government! For more information about our contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).
Principles and guidelines for participating in our open source community are can be found in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Governance
Information about how this project's community is governed may be found in [GOVERNANCE.md](GOVERNANCE.md).

## Security and Responsible Disclosure Policy
Refer to the [Department of Education Vulnerability Disclosure Policy](https://www.ed.gov/vulnerability-disclosure-policy)

## Public domain

This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).

All contributions to this project will be released under the CC0 dedication. By submitting a pull request or issue, you are agreeing to comply with this waiver of copyright interest.
