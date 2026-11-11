export interface Fee {
  id: string;
  label: string;
  type: 'Course' | 'Studio';
  amount: number;
  dueDate: string;
}

export interface Invoice {
  id: string;
  feeId: string;
  issuedOn: string;
  paidOn: string | null;
}

export interface ArtworkDraft {
  title: string;
  description: string;
  category: 'Painting' | 'Print' | 'Other';
  price: number;
  imageUrl: string;
}

export interface Artwork extends ArtworkDraft {
  id: string;
}

export interface Sale {
  id: string;
  artworkTitle: string;
  soldOn: string;
  price: number;
  commissionRate: number;
}

export interface StudentRecords {
  invoices: Invoice[];
  artworks: Artwork[];
}
