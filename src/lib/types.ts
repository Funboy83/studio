















export type Product = {
  id: string;
  imei: string;
  brand: string;
  model: string;
  price: number;
  storage: string;
  grade: string;
  color: string;
  carrier: string;
  battery: number;
  date: string;
  condition: string;
  status: 'Available' | 'Sold' | 'Deleted';
  createdAt: string; 
  updatedAt: string;
};

export type ProductHistory = Product & {
  status: 'Sold' | 'Deleted' | 'Voided';
  amount: number;
  movedAt: any;
  customerId?: string;
  customerName?: string;
  invoiceId?: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
  totalInvoices: number;
  totalSpent: number;
  debt: number;
  status: 'active' | 'inactive';
  customerType?: 'wholesale' | 'retail';
};

export type InvoiceItem = {
  id: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isCustom?: boolean;
  inventoryId?: string; // Link back to the original inventory item
};

export type Invoice = {
  id:string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string; // For walk-in customers
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  issueDate: string;
  dueDate: string;
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Voided' | 'Draft' | 'Overdue';
  summary?: string;
  createdAt: any;
  updatedAt?: any;
  amountPaid: number;
  paymentIds: string[];
  relatedCreditNoteId?: string;
  relatedInvoiceId?: string;
};

export type InvoiceDetail = Omit<Invoice, 'customerId' | 'customerName'> & {
  customer: Customer;
  items: InvoiceItem[];
  payments?: Payment[];
  isEdited?: boolean;
};

export type TenderDetail = {
  method: 'Cash' | 'Check' | 'Card/Zelle/Wire' | 'StoreCredit';
  amount: number;
};

export type AppliedInvoice = {
  id: string;
  invoiceNumber: string;
};

export type Payment = {
    id: string;
    customerId: string;
    paymentDate: any;
    recordedBy: string;
    amountPaid: number;
    type: 'payment' | 'refund';
    appliedToInvoices: string[];
    tenderDetails: TenderDetail[];
    notes?: string;
    sourceCreditNoteId?: string;
};

export type PaymentDetail = Omit<Payment, 'appliedToInvoices'> & {
  customerName: string;
  appliedToInvoices: InvoiceDetail[];
};


export type InvoiceHistory = Omit<Invoice, 'status' | 'createdAt'> & {
    status: 'Voided';
    archivedAt: any;
}

export type InvoiceHistoryDetail = Omit<InvoiceHistory, 'customerId' | 'customerName'> & {
    customer: Customer;
    items: InvoiceItem[];
};


export type Sale = {
  month: string;
  revenue: number;
};

export type RecentSale = {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
};

export type EditHistoryEntry = {
  id: string;
  timestamp: any;
  user: string;
  changes: Record<string, { from: any; to: any }>;
};

export type CreditNote = {
  id: string;
  originalInvoiceId: string;
  customerId: string;
  issueDate: string;
  items: InvoiceItem[];
  totalCredit: number;
  remainingCredit: number;
  status: 'available' | 'partially_used' | 'fully_used' | 'refunded';
  newExchangeInvoiceId?: string;
  refundPaymentId?: string;
};

export type CreditNoteDetail = CreditNote & {
    customerName: string;
};
