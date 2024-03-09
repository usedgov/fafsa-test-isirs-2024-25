## Test ISIR Files
The following test ISIRs are currently available. Additional test ISIRs will be added as they become available.
* These test ISIRs are hand-generated and should be considered drafts. We will update test ISIRs if issues are identified.
* All personally identifiable information (PII) in these test ISIRS is mock data and does not reflect real people.
* These test ISIRs reflect the current ISIR format. 
* To download a file: select the file, and on the resulting page click the "Download raw file" button in the upper right menu.

| Filename | Description |
|----------|-------------|
| [`IDSA25OP.zip`](https://fsapartners.ed.gov/sites/default/files/attachments/2023-09/IDSA25OP.zip)| Original file from 9/28/23 containing three test scenarios |
| [`IDSA25OP-with-fixed-padding-and-headers.dat.txt`](./IDSA25OP-with-fixed-padding-and-headers.dat.txt) | Fixed padding and SAIG headers for original file from 9/28/23 containing three test scenarios |
| [`test-isir-file-2024-25.dat.txt`](./test-isir-file-2024-25.dat.txt) | Single file containing hand crafted ISIR records for scenarios below |
| [`IDSA25OP-20240301.txt`](./IDSA25OP-20240301.txt) | Added full 100 [system-generated ISIR file FPS Test ISIR Data System Created File](https://fsapartners.ed.gov/knowledge-center/library/handbooks-manuals-or-guides/2023-05-31/2024-25-fafsa-specifications-guide-march-2024-update) published on March 8th, 2024 |
| [`IDSA25OP-20240301--no-headers.txt`](./IDSA25OP-20240301--no-headers.txt) | The 100 system-generated ISIR files, without SAIG headers for loading into EdExpress. |


### Hand crafted ISIR scenarios
From February 16th, 2024 posting.

| Scenario | Description |
|----------|-------------|
| 1 | Independent applicant with dependents, Pell eligible, FTI tax information |
| 2 | Provisionally independent applicant, processed with rejects, FTI tax information |
| 3 | Independent applicant without dependents, Pell eligible, manual tax information |
| 4 | Dependent applicant, two parents/contributors, all FTI non-filer tax information, max Pell |
| 5 | Dependent applicant, one parent/contributor, all FTI tax information, Pell eligible |
| 6 | Dependent applicant, two parents/contributors, student/one parent FTI tax information, other parent manual tax information, Pell ineligible due to SAI |
| 7 | Dependent applicant, two parents filed jointly so one contributor, all FTI tax information, Pell ineligible |
| 8 | Dependent applicant, one parent/contributor, applicant FTI non-tax filer, parent FTI tax information, Pell eligible |
