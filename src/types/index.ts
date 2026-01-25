export type Role = 'PATIENT' | 'DOCTOR' | 'PHARMACIST' | 'LAB_ASSISTANT' | 'RECEPTIONIST' | 'ADMIN';

export type User = {
    id: string; // or number depending on DB
    name: string;
    email: string;
    role: Role;
    phone?: string;
    createdAt: Date;
};

export type Patient = User & {
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    address: string;
    medicalHistory?: string;
};

export type Doctor = User & {
    specialization: string;
    licenseNumber: string;
};

export type AppointmentStatus = 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'ABSENT';

export type Appointment = {
    id: string;
    patientId: string;
    doctorId: string;
    date: string; // ISO Date
    timeSlot: string;
    queueNumber: number;
    status: AppointmentStatus;
    notes?: string;
    prescriptionId?: string;
    billId?: string;
};

export type Medicine = {
    id: string;
    name: string;
    stock: number;
    unit: string;
    pricePerUnit: number;
    expiryDate: string;
};

export type PrescriptionItem = {
    medicineId: string;
    dbMedicine?: Medicine;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
};

export type Prescription = {
    id: string;
    appointmentId: string;
    doctorId: string;
    items: PrescriptionItem[];
    issuedAt: Date;
    status: 'PENDING' | 'DISPENSED';
};

export type LabTest = {
    id: string;
    name: string;
    price: number;
    description?: string;
};

export type LabRequest = {
    id: string;
    appointmentId: string;
    testId: string;
    status: 'PENDING' | 'COMPLETED';
    resultUrl?: string; // URL to uploaded file
    requestedAt: Date;
};

export type Bill = {
    id: string;
    appointmentId: string;
    doctorFee: number;
    serviceCharge: number;
    pharmacyTotal: number;
    labTotal: number;
    totalAmount: number;
    status: 'PENDING' | 'PAID';
    generatedAt: Date;
};
