# Data Dictionary - Medical Center Management System

Based on the implemented user stories, here are the table specifications and record specifications governing the database schemas for the platform.

## 1. Users Table
**Description:** Stores information for all user types interacting with the system (Admin, Doctor, Receptionist, Lab Assistant, Pharmacist).
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **UserID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each user |
| **Role** | `ENUM` | NOT NULL | Role type (e.g., 'Admin', 'Doctor', 'Patient', 'Pharmacist', 'Receptionist', 'Lab Assistant') |
| **Name** | `VARCHAR (100)` | NOT NULL | User's full name |
| **Email** | `VARCHAR (255)` | UNIQUE, NOT NULL | User's email address |
| **ContactNo** | `VARCHAR (15)` | NOT NULL | User's contact number |
| **PasswordHash**| `VARCHAR (255)` | NOT NULL | Encrypted password for authentication |

## 2. Patients Table
**Description:** Stores patient-specific profiles, including family account linkages.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **PatientID** | `INT` | PRIMARY KEY, FOREIGN KEY | Unique patient identifier, references `Users.UserID` |
| **PrimaryAccID**| `INT` | FOREIGN KEY, NULLABLE | To link family members, references parent `PatientID` |
| **Address** | `VARCHAR (255)` | NOT NULL | Patient's residential address |
| **DOB** | `DATE` | NOT NULL | Patient's Date of Birth |
| **MedicalHx** | `TEXT` | | Brief overview of any preexisting medical history |

## 3. Appointments Table
**Description:** Records all scheduled appointments, dates, and current status.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **AppointmentID**| `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each appointment |
| **PatientID** | `INT` | FOREIGN KEY, NOT NULL | References `Patients.PatientID` |
| **DoctorID** | `INT` | FOREIGN KEY, NOT NULL | References `Users.UserID` (Doctor) |
| **ScheduledDate**| `DATE` | NOT NULL | Scheduled appointment date |
| **ScheduledTime**| `TIME` | NOT NULL | Scheduled appointment time |
| **Status** | `ENUM` | NOT NULL | 'Scheduled', 'Cancelled', 'Arrived', or 'Completed' |
| **CreatedAt** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | Time when the booking was made |

## 4. ClinicalNotes Table
**Description:** Stores clinical notes added by a doctor for a patient's visit.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **NoteID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the clinical note |
| **PatientID** | `INT` | FOREIGN KEY, NOT NULL | References `Patients.PatientID` |
| **DoctorID** | `INT` | FOREIGN KEY, NOT NULL | References `Users.UserID` (Doctor) |
| **AppointmentID**| `INT` | FOREIGN KEY, NULLABLE | Optional link to `Appointments.AppointmentID` |
| **NotesText** | `TEXT` | NOT NULL | Clinical observations and treatment details |
| **CreatedAt** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | Timestamp when the note was added |

## 5. LabTests Table
**Description:** Holds requests/recommendations for lab tests triggered by the doctor.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **TestID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the lab test request |
| **PatientID** | `INT` | FOREIGN KEY, NOT NULL | References `Patients.PatientID` |
| **DoctorID** | `INT` | FOREIGN KEY, NOT NULL | References `Users.UserID` (Doctor) |
| **TestName** | `VARCHAR (150)` | NOT NULL | Type or name of the requested lab test |
| **Status** | `ENUM` | NOT NULL | 'Pending', 'Processing', or 'Completed' |
| **TestCost** | `DECIMAL (10,2)`| NOT NULL | Price for the designated lab test |

## 6. LabReports Table
**Description:** Stores the final diagnostic reports uploaded by Lab Assistants.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **ReportID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the report |
| **TestID** | `INT` | FOREIGN KEY, NOT NULL | References `LabTests.TestID` |
| **LabAssistID** | `INT` | FOREIGN KEY, NOT NULL | References `Users.UserID` (Lab Assistant) |
| **ResultData** | `TEXT` | NULLABLE | Textual outline of the results |
| **ReportFileUrl**| `VARCHAR (255)` | NULLABLE | File path or URL to the uploaded PDF report |
| **UploadedAt** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | Time the report was produced and added |

## 7. Prescriptions Table
**Description:** High-level details of a prescription issued during a consultation.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **PrescriptionID**| `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the overall prescription |
| **PatientID** | `INT` | FOREIGN KEY, NOT NULL | References `Patients.PatientID` |
| **DoctorID** | `INT` | FOREIGN KEY, NOT NULL | References `Users.UserID` (Doctor) |
| **Status** | `ENUM` | NOT NULL | 'Pending', 'Dispensed', or 'Cancelled' |
| **IssuedAt** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | Time the doctor finalized the prescription |

## 8. PrescriptionItems Table
**Description:** The specific layout of individual medicines nested in a prescription.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **ItemID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for this line item |
| **PrescriptionID**| `INT` | FOREIGN KEY, NOT NULL | References `Prescriptions.PrescriptionID` |
| **MedicineID** | `INT` | FOREIGN KEY, NOT NULL | References `Medicines.MedicineID` |
| **Quantity** | `INT` | NOT NULL | Number of units prescribed to the patient |
| **Dosage** | `VARCHAR (100)` | NOT NULL | Instructions for consumption (e.g., '1-0-1 after food') |

## 9. Medicines Table (Inventory)
**Description:** Pharmacist's inventory database tracking stock and available medicines.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **MedicineID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the medicine type |
| **Name** | `VARCHAR (150)` | NOT NULL | Name of the medicine/drug |
| **StockCount** | `INT` | NOT NULL, DEFAULT 0 | Current quantity available in the pharmacy |
| **UnitPrice** | `DECIMAL (10,2)`| NOT NULL | Price per unit of medicine |
| **ReorderLevel** | `INT` | NOT NULL, DEFAULT 10 | Stock threshold to trigger an 'out of stock' warning |

## 10. Invoices Table
**Description:** Consolidates billing for a patient's visit (consultation, medicines, lab tests).
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **InvoiceID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the billing invoice |
| **PatientID** | `INT` | FOREIGN KEY, NOT NULL | References `Patients.PatientID` |
| **AppointmentID**| `INT` | FOREIGN KEY, NULLABLE | Links to `Appointments.AppointmentID` if tied to a visit |
| **TotalAmount** | `DECIMAL (10,2)`| NOT NULL | Aggregated cost for the visit |
| **PaymentStatus**| `ENUM` | NOT NULL | 'Pending', 'Paid', or 'Failed' |
| **IssuedAt** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | Date the invoice was generated |

## 11. SystemLogs Table
**Description:** Complete history matrix for Admin usage to track system activities.
| Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **LogID** | `INT` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the log entry |
| **UserID** | `INT` | FOREIGN KEY, NULLABLE | User who triggered the action, references `Users.UserID` |
| **Action** | `VARCHAR (255)` | NOT NULL | Description of the action (e.g., 'User Registered') |
| **Timestamp** | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | System-generated time of occurrence |
