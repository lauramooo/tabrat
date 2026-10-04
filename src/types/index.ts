export interface ReceiptItem {
  id: string;
  name: string;
  price: number;    // total price (quantity × unit price), including any modifiers below
  quantity: number;
  assignedTo: string[];
  category?: string;   // e.g. 'Drinks' | 'Apps' | 'Dessert' — used to filter the Assign screen
  modifiers?: string[]; // sides/sauces/customizations printed under this item on the receipt
}

// One of possibly several people who paid the bill, with how much each paid.
export interface Payer {
  personId: string;
  amount: number;
}

// Per-person settle-up status for a saved tab.
export interface PaymentStatus {
  personId: string;
  paid: boolean;
  amountPaid: number;
}

// Shared open/closed status for tabs and trips.
export type OpenClosedStatus = 'open' | 'closed';

export interface Person {
  id: string;
  name: string;
}

export interface ExtraCharge {
  id: string;
  name: string;
  amount: number;
  isDiscount?: boolean;
}

export interface ParsedReceipt {
  restaurantName?: string;
  receiptDate?: string;
  items: { name: string; price: number; quantity: number; modifiers?: string[] }[];
  subtotal: number;
  tax: number;
  tip: number;
  extraCharges?: { name: string; amount: number; isDiscount?: boolean }[];
  total: number;
}

export interface PersonSplit {
  person: Person;
  itemShares: { item: ReceiptItem; share: number }[];
  subtotal: number;
  taxShare: number;
  tipShare: number;
  extraShare: number;
  total: number;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  members: string[];
}

export interface Trip {
  id: string;
  name: string;
  emoji: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  people?: string[];
  status?: OpenClosedStatus;   // defaults to 'open' when created
  currency?: string;           // ISO code, e.g. 'USD', 'JPY' — primary currency
  currencies?: string[];       // all accepted currencies for international trips
  budget?: number;             // personal spending target for this trip
  groupBudget?: number;        // whole-group spending target for this trip
  joinCode?: string;           // lets someone else join as a full collaborator
}

export interface Home {
  id: string;
  name: string;
  emoji: string;
  members: string[];   // names of housemates
  createdAt: string;
  endDate?: string;
  currency?: string;
  status?: 'open' | 'closed';
  joinCode?: string;           // lets someone else join as a full collaborator
}

export interface SplitRecord {
  id: string;
  date: string;
  restaurantName?: string;
  receiptDate?: string;
  total: number;
  people: string[];
  itemCount: number;
  // Full data stored for re-loading the split
  items?: ReceiptItem[];
  fullPeople?: Person[];
  extraCharges?: ExtraCharge[];
  tax?: number;
  tip?: number;
  imageUri?: string;
  // Legacy single-payer fields — kept so existing UI (assign.tsx, summary.tsx) still compiles.
  // New code should prefer `payers` below, which supports more than one person paying.
  paidById?: string;
  paidByName?: string;
  // Trip / Home linkage
  tripId?: string;
  homeId?: string;
  personAmounts?: Array<{ name: string; amount: number }>;
  expenseCategory?: string;
  status?: OpenClosedStatus;       // defaults to 'open' on save; 'closed' once settled
  currency?: string;               // ISO code, defaults to 'USD' if unset
  payers?: Payer[];                // multi-payer support; first entry mirrors paidById/paidByName
  paymentStatuses?: PaymentStatus[]; // settle-up tracking per person, used by "mark as paid"
  source?: 'manual' | 'scan';       // 'manual' = entered by hand, 'scan' = from receipt photo
  // Only set for a standalone bill (no tripId/homeId) — lets someone else join as a full
  // collaborator. Trip/home expenses are shared via their trip's/home's own joinCode instead.
  joinCode?: string;
}

// -- Roadmap / feedback board ----------------------------------------------------
// Unlike everything else above, this is shared data: every signed-in account sees every
// submission (see supabase/migrations/0007_feedback_board.sql), not just its own.

export type FeedbackType = 'idea' | 'bug';
export type FeedbackStatus = 'under_review' | 'planned' | 'in_progress' | 'done' | 'declined';

export interface FeedbackItem {
  id: string;
  userId: string;
  type: FeedbackType;
  title: string;
  description?: string;
  imageUrl?: string;
  status: FeedbackStatus;
  voteCount: number;
  createdAt: string;
  myVote: boolean; // whether the current account has voted on this item
}
