import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExtraCharge, Group, Home, OpenClosedStatus, ParsedReceipt, Payer, PaymentStatus, Person, ReceiptItem, SplitRecord, Trip } from '@/types';
import { fmtDate } from '@/utils/date';

const DEFAULT_EXPENSE_CATEGORIES = ['Hotel', 'Food & Drinks', 'Transport', 'Activities', 'Shopping', 'Other'];
const DEFAULT_HOME_EXPENSE_CATEGORIES = ['Rent', 'Electric', 'Gas', 'Water', 'Internet', 'Groceries', 'Cleaning', 'Subscriptions', 'Other'];

// Item-level categories for the Assign screen's drink/app/dessert filter.
export const DEFAULT_ITEM_CATEGORIES = ['Drinks', 'Apps', 'Dessert', 'Mains', 'Other'];

const DEFAULT_CURRENCY = 'USD';

interface SplitState {
  imageUri: string | null;
  imageBase64: string | null;
  restaurantName: string;
  receiptDate: string;
  items: ReceiptItem[];
  extraCharges: ExtraCharge[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  people: Person[];
  paidBy: string | null;
  payers: Payer[];          // multi-payer support; `paidBy` above stays as a single-payer convenience mirror
  currency: string;
  history: SplitRecord[];
  groups: Group[];
  trips: Trip[];
  tripPayments: { id: string; tripId: string; from: string; to: string; amount: number; date: string }[];
  homePayments: { id: string; homeId: string; from: string; to: string; amount: number; date: string }[];
  activeTripId: string | null;
  activeHomeId: string | null;
  splitSaved: boolean;
  savedSplitId: string | null;
  expenseCategory: string | null;
  expenseCategories: string[];
  homeExpenseCategories: string[];
  itemCategories: string[];
  defaultCurrency: string;

  setImage: (uri: string, base64: string) => void;
  setReceiptData: (data: ParsedReceipt) => void;
  updateItem: (id: string, name: string, price: number, quantity: number, category?: string) => void;
  addItemWithDetails: (name: string, price: number, quantity?: number, category?: string) => void;
  setItemCategory: (id: string, category: string | undefined) => void;
  addItemCategory: (cat: string) => void;
  removeItem: (id: string) => void;
  setItemOrder: (ids: string[]) => void;
  splitItemQty: (id: string) => void;
  splitItemQtyAssigned: (id: string, assignees: string[][]) => void;
  setRestaurantName: (name: string) => void;
  setReceiptDate: (date: string) => void;
  setTax: (tax: number) => void;
  setTip: (tip: number) => void;
  addExtraCharge: () => void;
  addDiscount: () => void;
  addExtraChargeWithDetails: (name: string, amount: number, isDiscount?: boolean) => void;
  updateExtraCharge: (id: string, name: string, amount: number) => void;
  removeExtraCharge: (id: string) => void;
  addPerson: (name: string) => void;
  removePerson: (id: string) => void;
  toggleAssignment: (itemId: string, personId: string) => void;
  setItemAssignees: (itemId: string, personIds: string[]) => void;
  setPaidBy: (personId: string | null) => void;
  // Multi-payer support — operate on `payers`. `setPaidBy` above keeps working as a single-payer shortcut.
  addPayer: (personId: string, amount?: number) => void;
  removePayer: (personId: string) => void;
  setPayerAmount: (personId: string, amount: number) => void;
  setCurrency: (currency: string) => void;
  setDefaultCurrency: (currency: string) => void;
  reset: () => void;
  saveSplit: () => void;
  clearHistory: () => void;
  deleteHistory: (id: string) => void;
  loadSplit: (record: SplitRecord, viewMode?: boolean) => void;
  // Open/closed status for saved tabs (settle-up state, not just "exists in history").
  updateRecord: (id: string, patch: { restaurantName?: string; receiptDate?: string; expenseCategory?: string }) => void;
  closeTab: (id: string) => void;
  reopenTab: (id: string) => void;
  // Per-person settle-up tracking on a saved tab ("mark as paid").
  setPersonPaid: (tabId: string, personId: string, paid: boolean, amountPaid?: number) => void;
  homes: Home[];
  addHome: (name: string, emoji: string, members: string[], currency?: string) => string;
  updateHome: (id: string, name: string, emoji: string, members: string[], startDate?: string, endDate?: string) => void;
  deleteHome: (id: string) => void;
  closeHome: (id: string) => void;
  reopenHome: (id: string) => void;
  saveHomeExpenseDirectly: (params: {
    name: string;
    receiptDate: string;
    category: string | null;
    amount: number;
    participants: string[];
    paidByName: string | null;
    homeId: string;
  }) => void;
  friends: Person[];
  addFriend: (name: string) => void;
  removeFriend: (id: string) => void;
  updateFriend: (id: string, name: string) => void;
  addGroup: (name: string, icon: string, members: string[]) => void;
  updateGroup: (id: string, name: string, icon: string, members: string[]) => void;
  deleteGroup: (id: string) => void;
  addTrip: (name: string, emoji: string, startDate: string, people?: string[], currency?: string, currencies?: string[], budget?: number, groupBudget?: number) => string;
  updateTrip: (id: string, name: string, emoji: string, startDate: string, endDate?: string, people?: string[], currency?: string, currencies?: string[], budget?: number, groupBudget?: number) => void;
  deleteTrip: (id: string) => void;
  addTripPayment: (tripId: string, from: string, to: string, amount: number) => void;
  removeTripPaymentsFor: (tripId: string, from: string, to: string) => void;
  addHomePayment: (homeId: string, from: string, to: string, amount: number) => void;
  removeHomePaymentsFor: (homeId: string, from: string, to: string) => void;
  closeTrip: (id: string) => void;
  reopenTrip: (id: string) => void;
  linkTabToTrip: (tabId: string, tripId: string) => void;
  linkTabToHome: (tabId: string, homeId: string) => void;
  startHomeEntry: (homeId: string) => void;
  setActiveHomeId: (id: string | null) => void;
  setExpenseCategory: (cat: string | null) => void;
  addExpenseCategory: (cat: string) => void;
  updateExpenseCategory: (oldCat: string, newCat: string) => void;
  removeExpenseCategory: (cat: string) => void;
  addHomeExpenseCategory: (cat: string) => void;
  updateHomeExpenseCategory: (oldCat: string, newCat: string) => void;
  removeHomeExpenseCategory: (cat: string) => void;
  saveTripExpenseDirectly: (params: {
    name: string;
    receiptDate: string;
    category: string | null;
    rawItems: Array<{ name: string; price: number; quantity: number }>;
    participants: string[];
    paidByName: string | null;
    tripId: string;
    currency?: string;
    imageUri?: string;
  }) => void;
  startTripEntry: (tripId: string) => void;
  setActiveTripId: (id: string | null) => void;
}

let idSeq = 0;
const uid = () => `${Date.now().toString(36)}-${(++idSeq).toString(36)}`;

const initial = {
  imageUri: null as string | null,
  imageBase64: null as string | null,
  restaurantName: '',
  receiptDate: fmtDate(new Date()),
  items: [] as ReceiptItem[],
  extraCharges: [] as ExtraCharge[],
  subtotal: 0,
  tax: 0,
  tip: 0,
  total: 0,
  people: [] as Person[],
  paidBy: null as string | null,
  payers: [] as Payer[],
  currency: DEFAULT_CURRENCY,
  splitSaved: false,
  savedSplitId: null as string | null,
  expenseCategory: null as string | null,
};

export const useSplitStore = create<SplitState>()(
  persist(
    (set, get) => ({
      ...initial,
      history: [],
      groups: [],
      trips: [],
      tripPayments: [] as { id: string; tripId: string; from: string; to: string; amount: number; date: string }[],
      homePayments: [] as { id: string; homeId: string; from: string; to: string; amount: number; date: string }[],
      homes: [],
      friends: [],
      activeTripId: null as string | null,
      activeHomeId: null as string | null,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
      homeExpenseCategories: DEFAULT_HOME_EXPENSE_CATEGORIES,
      itemCategories: DEFAULT_ITEM_CATEGORIES,
      defaultCurrency: DEFAULT_CURRENCY,

      setImage: (uri, base64) => set({ imageUri: uri, imageBase64: base64 }),

      setReceiptData: (data) => {
        const items: ReceiptItem[] = data.items.map((i) => ({
          id: uid(),
          name: i.name,
          price: i.price,
          quantity: i.quantity ?? 1,
          assignedTo: [],
        }));
        set({
          items,
          extraCharges: [],
          restaurantName: data.restaurantName ?? '',
          receiptDate: data.receiptDate ? (fmtDate(data.receiptDate) || data.receiptDate) : '',
          subtotal: data.subtotal,
          tax: data.tax,
          tip: data.tip,
          total: data.total,
        });
      },

      updateItem: (id, name, price, quantity, category) =>
        set((s) => ({
          items: s.items.map((item) =>
            item.id === id ? { ...item, name, price, quantity, ...(category !== undefined ? { category } : {}) } : item,
          ),
        })),

      addItemWithDetails: (name, price, quantity = 1, category) =>
        set((s) => ({
          items: [...s.items, { id: uid(), name: name.trim(), price, quantity, assignedTo: [], category }],
        })),

      setItemCategory: (id, category) =>
        set((s) => ({
          items: s.items.map((item) => (item.id === id ? { ...item, category } : item)),
        })),

      addItemCategory: (cat) =>
        set((s) => ({
          itemCategories: s.itemCategories.includes(cat) ? s.itemCategories : [...s.itemCategories, cat],
        })),

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      setItemOrder: (ids) =>
        set((s) => {
          const map = new Map(s.items.map((i) => [i.id, i]));
          return { items: ids.map((id) => map.get(id)!).filter(Boolean) };
        }),

      splitItemQty: (id) =>
        set((s) => {
          const item = s.items.find((i) => i.id === id);
          if (!item || item.quantity <= 1) return s;
          const unitPrice = item.price / item.quantity;
          const copies = Array.from({ length: item.quantity }, () => ({
            ...item, id: uid(), quantity: 1, price: unitPrice, assignedTo: [],
          }));
          const idx = s.items.findIndex((i) => i.id === id);
          return { items: [...s.items.slice(0, idx), ...copies, ...s.items.slice(idx + 1)] };
        }),

      splitItemQtyAssigned: (id, assignees) =>
        set((s) => {
          const item = s.items.find((i) => i.id === id);
          if (!item || item.quantity <= 1) return s;
          const unitPrice = item.price / item.quantity;
          const copies = Array.from({ length: item.quantity }, (_, i) => ({
            ...item, id: uid(), quantity: 1, price: unitPrice, assignedTo: assignees[i] ?? [],
          }));
          const idx = s.items.findIndex((i) => i.id === id);
          return { items: [...s.items.slice(0, idx), ...copies, ...s.items.slice(idx + 1)] };
        }),

      setRestaurantName: (name) => {
        const { savedSplitId } = get();
        set((s) => ({
          restaurantName: name,
          history: savedSplitId
            ? s.history.map((r) => r.id === savedSplitId ? { ...r, restaurantName: name || undefined } : r)
            : s.history,
        }));
      },
      setReceiptDate: (date) => {
        const normalized = date ? (fmtDate(date) || date) : date;
        const { savedSplitId } = get();
        set((s) => ({
          receiptDate: normalized,
          history: savedSplitId
            ? s.history.map((r) => r.id === savedSplitId ? { ...r, receiptDate: normalized || undefined } : r)
            : s.history,
        }));
      },
      setTax: (tax) => set({ tax }),
      setTip: (tip) => set({ tip }),

      addExtraCharge: () =>
        set((s) => ({
          extraCharges: [...s.extraCharges, { id: uid(), name: '', amount: 0 }],
        })),

      addDiscount: () =>
        set((s) => ({
          extraCharges: [...s.extraCharges, { id: uid(), name: 'Discount', amount: 0, isDiscount: true }],
        })),

      addExtraChargeWithDetails: (name, amount, isDiscount) =>
        set((s) => ({
          extraCharges: [...s.extraCharges, { id: uid(), name: name.trim(), amount, isDiscount }],
        })),

      updateExtraCharge: (id, name, amount) =>
        set((s) => ({
          extraCharges: s.extraCharges.map((c) => (c.id === id ? { ...c, name, amount } : c)),
        })),

      removeExtraCharge: (id) =>
        set((s) => ({ extraCharges: s.extraCharges.filter((c) => c.id !== id) })),

      addPerson: (name) =>
        set((s) => ({ people: [...s.people, { id: uid(), name: name.trim() }] })),

      removePerson: (personId) =>
        set((s) => ({
          people: s.people.filter((p) => p.id !== personId),
          items: s.items.map((item) => ({
            ...item,
            assignedTo: item.assignedTo.filter((id) => id !== personId),
          })),
        })),

      toggleAssignment: (itemId, personId) =>
        set((s) => ({
          items: s.items.map((item) => {
            if (item.id !== itemId) return item;
            const has = item.assignedTo.includes(personId);
            return {
              ...item,
              assignedTo: has
                ? item.assignedTo.filter((id) => id !== personId)
                : [...item.assignedTo, personId],
            };
          }),
        })),

      setItemAssignees: (itemId, personIds) =>
        set((s) => ({
          items: s.items.map((item) =>
            item.id === itemId ? { ...item, assignedTo: personIds } : item,
          ),
        })),

      setPaidBy: (personId) => {
        const { savedSplitId, people } = get();
        const paidByName = personId ? people.find((p) => p.id === personId)?.name : undefined;
        set((s) => ({
          paidBy: personId,
          history: savedSplitId
            ? s.history.map((r) => r.id === savedSplitId ? { ...r, paidById: personId ?? undefined, paidByName } : r)
            : s.history,
        }));
      },

      addPayer: (personId, amount = 0) =>
        set((s) => ({
          payers: s.payers.some((p) => p.personId === personId)
            ? s.payers
            : [...s.payers, { personId, amount }],
          // keep the legacy single-payer field pointed at the first payer for old UI/back-compat
          paidBy: s.paidBy ?? personId,
        })),

      removePayer: (personId) =>
        set((s) => ({
          payers: s.payers.filter((p) => p.personId !== personId),
          paidBy: s.paidBy === personId ? (s.payers.find((p) => p.personId !== personId)?.personId ?? null) : s.paidBy,
        })),

      setPayerAmount: (personId, amount) =>
        set((s) => ({
          payers: s.payers.map((p) => (p.personId === personId ? { ...p, amount } : p)),
        })),

      setCurrency: (currency) => set({ currency }),
      setDefaultCurrency: (currency) => set({ defaultCurrency: currency }),

      reset: () => set({ ...initial, receiptDate: fmtDate(new Date()) }),

      saveSplit: () => {
        const { items, people, tax, tip, extraCharges, restaurantName, receiptDate, imageUri, paidBy, payers, currency, splitSaved, activeTripId, activeHomeId, expenseCategory } = get();
        if (splitSaved || (items.length === 0 && people.length === 0)) return;
        const subtotal = items.reduce((s, i) => s + i.price, 0);
        const extraTotal = extraCharges.reduce((s, c) => s + (c.isDiscount ? -c.amount : c.amount), 0);
        const total = subtotal + tax + tip + extraTotal;

        // Compute per-person totals for trip settlement
        const personSubtotals: Record<string, number> = {};
        people.forEach((p) => (personSubtotals[p.id] = 0));
        for (const item of items) {
          if (item.assignedTo.length === 0) continue;
          const share = item.price / item.assignedTo.length;
          for (const pid of item.assignedTo) {
            if (pid in personSubtotals) personSubtotals[pid] += share;
          }
        }
        const grandSub = Object.values(personSubtotals).reduce((a, b) => a + b, 0);
        const personAmounts = people.map((p) => {
          const sub = personSubtotals[p.id];
          const ratio = grandSub > 0 ? sub / grandSub : 1 / (people.length || 1);
          return { name: p.name, amount: sub + tax * ratio + tip * ratio + extraTotal * ratio };
        });

        const record: SplitRecord = {
          id: uid(),
          date: new Date().toISOString(),
          restaurantName: restaurantName || undefined,
          receiptDate: receiptDate || undefined,
          total,
          people: people.map((p) => p.name),
          itemCount: items.length,
          items: items.map((i) => ({ ...i })),
          fullPeople: people.map((p) => ({ ...p })),
          extraCharges: extraCharges.map((c) => ({ ...c })),
          tax,
          tip,
          imageUri: imageUri ?? undefined,
          paidById: paidBy ?? undefined,
          tripId: activeTripId ?? undefined,
          homeId: activeHomeId ?? undefined,
          personAmounts,
          paidByName: paidBy ? (people.find((p) => p.id === paidBy)?.name) : undefined,
          expenseCategory: expenseCategory ?? undefined,
          status: 'open',
          currency,
          payers: payers.length > 0 ? payers : (paidBy ? [{ personId: paidBy, amount: total }] : undefined),
          paymentStatuses: people.map((p) => ({ personId: p.id, paid: false, amountPaid: 0 })),
          source: 'scan',
        };
        set((s) => ({ history: [record, ...s.history].slice(0, 50), splitSaved: true, savedSplitId: record.id }));
      },

      clearHistory: () => set({ history: [] }),

      deleteHistory: (id) => set((s) => ({ history: s.history.filter((r) => r.id !== id) })),

      updateRecord: (id, patch) => {
        const normalizedPatch = patch.receiptDate
          ? { ...patch, receiptDate: fmtDate(patch.receiptDate) || patch.receiptDate }
          : patch;
        set((s) => ({ history: s.history.map((r) => r.id === id ? { ...r, ...normalizedPatch } : r) }));
      },

      closeTab: (id) =>
        set((s) => ({ history: s.history.map((r) => (r.id === id ? { ...r, status: 'closed' } : r)) })),

      reopenTab: (id) =>
        set((s) => ({ history: s.history.map((r) => (r.id === id ? { ...r, status: 'open' } : r)) })),

      setPersonPaid: (tabId, personId, paid, amountPaid = 0) =>
        set((s) => ({
          history: s.history.map((r) => {
            if (r.id !== tabId) return r;
            const existing = r.paymentStatuses ?? [];
            const has = existing.some((ps) => ps.personId === personId);
            const paymentStatuses = has
              ? existing.map((ps) => (ps.personId === personId ? { ...ps, paid, amountPaid } : ps))
              : [...existing, { personId, paid, amountPaid }];
            const nonPayerStatuses = r.paidById
              ? paymentStatuses.filter((ps) => ps.personId !== r.paidById)
              : paymentStatuses;
            const allPaid = nonPayerStatuses.length > 0 && nonPayerStatuses.every((ps) => ps.paid);
            return { ...r, paymentStatuses, status: allPaid ? 'closed' : r.status };
          }),
        })),

      addHome: (name, emoji, members, currency = DEFAULT_CURRENCY) => {
        const id = uid();
        set((s) => ({
          homes: [{ id, name, emoji, members, createdAt: new Date().toISOString(), currency }, ...s.homes],
        }));
        return id;
      },

      updateHome: (id, name, emoji, members, startDate, endDate) =>
        set((s) => ({
          homes: s.homes.map((h) => h.id === id
            ? { ...h, name, emoji, members, ...(startDate !== undefined && { createdAt: startDate }), endDate }
            : h),
        })),

      deleteHome: (id) =>
        set((s) => ({
          homes: s.homes.filter((h) => h.id !== id),
          history: s.history.filter((r) => r.homeId !== id),
          homePayments: (s.homePayments ?? []).filter((p) => p.homeId !== id),
        })),

      closeHome: (id) => set((s) => ({ homes: s.homes.map((h) => (h.id === id ? { ...h, status: 'closed' } : h)) })),
      reopenHome: (id) => set((s) => ({ homes: s.homes.map((h) => (h.id === id ? { ...h, status: 'open' } : h)) })),

      saveHomeExpenseDirectly: ({ name, receiptDate, category, amount, participants, paidByName, homeId }) => {
        const n = participants.length || 1;
        const share = amount / n;
        const personIds = participants.map(() => uid());
        const personAmounts = participants.map((pName) => ({ name: pName, amount: share }));
        const record: SplitRecord = {
          id: uid(),
          date: new Date().toISOString(),
          restaurantName: name || undefined,
          receiptDate: receiptDate ? (fmtDate(receiptDate) || receiptDate) : undefined,
          total: amount,
          people: participants,
          itemCount: 1,
          items: [{ id: uid(), name, price: amount, quantity: 1, assignedTo: personIds }],
          fullPeople: participants.map((pName, i) => ({ id: personIds[i], name: pName })),
          extraCharges: [],
          tax: 0,
          tip: 0,
          paidByName: paidByName || undefined,
          homeId,
          personAmounts,
          expenseCategory: category || undefined,
          status: 'open',
          currency: get().homes.find((h) => h.id === homeId)?.currency ?? 'USD',
          paymentStatuses: participants.map((_, i) => ({ personId: personIds[i], paid: false, amountPaid: 0 })),
          source: 'manual',
        };
        set((s) => ({ history: [record, ...s.history].slice(0, 50) }));
      },

      addFriend: (name) =>
        set((s) => ({ friends: [...s.friends, { id: uid(), name: name.trim() }] })),

      removeFriend: (id) =>
        set((s) => ({ friends: s.friends.filter((f) => f.id !== id) })),

      updateFriend: (id, name) =>
        set((s) => ({ friends: s.friends.map((f) => f.id === id ? { ...f, name: name.trim() } : f) })),

      addGroup: (name, icon, members) =>
        set((s) => ({ groups: [...s.groups, { id: uid(), name, icon, members }] })),

      updateGroup: (id, name, icon, members) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, name, icon, members } : g)),
        })),

      deleteGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

      addTrip: (name, emoji, startDate, people, currency = DEFAULT_CURRENCY, currencies, budget, groupBudget) => {
        const id = uid();
        const currList = currencies && currencies.length > 0 ? currencies : [currency];
        set((s) => ({
          trips: [{ id, name, emoji, startDate, createdAt: new Date().toISOString(), people, status: 'open', currency: currList[0], currencies: currList, budget, groupBudget }, ...s.trips],
        }));
        return id;
      },

      updateTrip: (id, name, emoji, startDate, endDate, people, currency, currencies, budget, groupBudget) =>
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== id) return t;
            const currList = currencies && currencies.length > 0 ? currencies : (currency ? [currency] : t.currencies ?? [t.currency ?? 'USD']);
            return { ...t, name, emoji, startDate, endDate, people, currency: currList[0], currencies: currList, budget, groupBudget };
          }),
        })),

      deleteTrip: (id) =>
        set((s) => ({
          trips: s.trips.filter((t) => t.id !== id),
          history: s.history.filter((r) => r.tripId !== id),
          tripPayments: s.tripPayments.filter((p) => p.tripId !== id),
        })),

      addTripPayment: (tripId, from, to, amount) =>
        set((s) => ({
          tripPayments: [...s.tripPayments, { id: uid(), tripId, from, to, amount, date: new Date().toISOString() }],
        })),

      removeTripPaymentsFor: (tripId, from, to) =>
        set((s) => ({
          tripPayments: s.tripPayments.filter((p) => !(p.tripId === tripId && p.from === from && p.to === to)),
        })),

      addHomePayment: (homeId, from, to, amount) =>
        set((s) => ({
          homePayments: [...(s.homePayments ?? []), { id: uid(), homeId, from, to, amount, date: new Date().toISOString() }],
        })),

      removeHomePaymentsFor: (homeId, from, to) =>
        set((s) => ({
          homePayments: (s.homePayments ?? []).filter((p) => !(p.homeId === homeId && p.from === from && p.to === to)),
        })),

      closeTrip: (id) => set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, status: 'closed' } : t)) })),

      reopenTrip: (id) => set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, status: 'open' } : t)) })),

      linkTabToTrip: (tabId, tripId) =>
        set((s) => ({
          history: s.history.map((r) => r.id === tabId ? { ...r, tripId } : r),
        })),

      linkTabToHome: (tabId, homeId) =>
        set((s) => ({
          history: s.history.map((r) => r.id === tabId ? { ...r, homeId } : r),
        })),

      startHomeEntry: (homeId) => {
        const home = get().homes.find((h) => h.id === homeId);
        set({
          ...initial,
          activeTripId: null,
          activeHomeId: homeId,
          people: (home?.members ?? []).map((name) => ({ id: uid(), name })),
          currency: home?.currency ?? DEFAULT_CURRENCY,
        });
      },

      setActiveHomeId: (id) => set({ activeHomeId: id }),

      setExpenseCategory: (cat) => set({ expenseCategory: cat }),

      addExpenseCategory: (cat) =>
        set((s) => ({
          expenseCategories: s.expenseCategories.includes(cat)
            ? s.expenseCategories
            : [...s.expenseCategories, cat],
        })),

      updateExpenseCategory: (oldCat, newCat) =>
        set((s) => ({
          expenseCategories: s.expenseCategories.map((c) => c === oldCat ? newCat.trim() : c),
          history: s.history.map((r) => r.expenseCategory === oldCat ? { ...r, expenseCategory: newCat.trim() } : r),
        })),

      removeExpenseCategory: (cat) =>
        set((s) => ({
          expenseCategories: s.expenseCategories.filter((c) => c !== cat),
        })),

      addHomeExpenseCategory: (cat) =>
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.includes(cat)
            ? s.homeExpenseCategories
            : [...s.homeExpenseCategories, cat],
        })),

      updateHomeExpenseCategory: (oldCat, newCat) =>
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.map((c) => c === oldCat ? newCat.trim() : c),
          history: s.history.map((r) => r.expenseCategory === oldCat ? { ...r, expenseCategory: newCat.trim() } : r),
        })),

      removeHomeExpenseCategory: (cat) =>
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.filter((c) => c !== cat),
        })),

      saveTripExpenseDirectly: ({ name, receiptDate, category, rawItems, participants, paidByName, tripId, currency: expCurrency, imageUri }) => {
        if (rawItems.length === 0) return;
        const total = rawItems.reduce((s, i) => s + i.price, 0);
        const n = participants.length || 1;
        const share = total / n;
        const personIds = participants.map(() => uid());
        const personAmounts = participants.map((pName, i) => ({ name: pName, amount: share }));
        const record: SplitRecord = {
          id: uid(),
          date: new Date().toISOString(),
          restaurantName: name || undefined,
          receiptDate: receiptDate ? (fmtDate(receiptDate) || receiptDate) : undefined,
          total,
          people: participants,
          itemCount: rawItems.length,
          items: rawItems.map((i) => ({ id: uid(), ...i, assignedTo: personIds })),
          fullPeople: participants.map((pName, i) => ({ id: personIds[i], name: pName })),
          extraCharges: [],
          tax: 0,
          tip: 0,
          imageUri,
          paidByName: paidByName || undefined,
          tripId,
          personAmounts,
          expenseCategory: category || undefined,
          status: 'open',
          currency: expCurrency ?? get().trips.find((t) => t.id === tripId)?.currency ?? 'USD',
          payers: paidByName
            ? [{ personId: personIds[participants.indexOf(paidByName)] ?? personIds[0], amount: total }]
            : undefined,
          paymentStatuses: participants.map((_, i) => ({ personId: personIds[i], paid: false, amountPaid: 0 })),
          source: 'manual',
        };
        set((s) => ({ history: [record, ...s.history].slice(0, 50) }));
      },

      startTripEntry: (tripId) => {
        const trip = get().trips.find((t) => t.id === tripId);
        set({
          ...initial,
          activeHomeId: null,
          activeTripId: tripId,
          people: (trip?.people ?? []).map((name) => ({ id: uid(), name })),
          currency: trip?.currency ?? DEFAULT_CURRENCY,
        });
      },

      setActiveTripId: (id) => set({ activeTripId: id }),

      loadSplit: (record, viewMode = false) => {
        if (!record.items || !record.fullPeople) return;
        set({
          ...initial,
          imageUri: record.imageUri ?? null,
          restaurantName: record.restaurantName ?? '',
          receiptDate: record.receiptDate ? (fmtDate(record.receiptDate) || record.receiptDate) : '',
          items: record.items.map((i) => ({ ...i })),
          people: record.fullPeople.map((p) => ({ ...p })),
          extraCharges: (record.extraCharges ?? []).map((c) => ({ ...c })),
          tax: record.tax ?? 0,
          tip: record.tip ?? 0,
          paidBy: record.paidById ?? null,
          payers: record.payers ? record.payers.map((p) => ({ ...p })) : [],
          currency: record.currency ?? DEFAULT_CURRENCY,
          splitSaved: viewMode,
          savedSplitId: viewMode ? record.id : null,
        });
      },
    }),
    {
      name: 'split-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ history: state.history, groups: state.groups, trips: state.trips, tripPayments: state.tripPayments, homes: state.homes, friends: state.friends, expenseCategories: state.expenseCategories, homeExpenseCategories: state.homeExpenseCategories, itemCategories: state.itemCategories, defaultCurrency: state.defaultCurrency, imageUri: state.imageUri, imageBase64: state.imageBase64 }),
    },
  ),
);
