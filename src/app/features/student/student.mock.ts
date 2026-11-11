import { Fee, Sale, StudentRecords } from './student.models';

export const COURSES = ['Drawing Fundamentals', 'Printmaking'];
export const MEMBERSHIP = { name: 'Open Studio', expiresOn: '2027-01-31' };

export const FEES: readonly Fee[] = [
  {
    id: 'drawing',
    label: 'Drawing Fundamentals',
    type: 'Course',
    amount: 1800,
    dueDate: '2026-10-01',
  },
  { id: 'printmaking', label: 'Printmaking', type: 'Course', amount: 1500, dueDate: '2026-11-30' },
  { id: 'studio', label: 'Open Studio', type: 'Studio', amount: 600, dueDate: '2026-11-30' },
];

export const INITIAL_RECORDS: StudentRecords = {
  invoices: [
    { id: 'INV-DRAWING', feeId: 'drawing', issuedOn: '2026-09-20', paidOn: '2026-09-25' },
    { id: 'INV-PRINTMAKING', feeId: 'printmaking', issuedOn: '2026-11-01', paidOn: null },
  ],
  artworks: [],
};

export const SALES: readonly Sale[] = [
  {
    id: 'sale-1',
    artworkTitle: 'Quiet Harbour',
    soldOn: '2026-11-03',
    price: 1200,
    commissionRate: 0.15,
  },
  {
    id: 'sale-2',
    artworkTitle: 'Blue Courtyard',
    soldOn: '2026-10-22',
    price: 800,
    commissionRate: 0.15,
  },
];
