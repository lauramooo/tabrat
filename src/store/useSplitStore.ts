import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExtraCharge, Group, Home, OpenClosedStatus, ParsedReceipt, Payer, PaymentStatus, Person, ReceiptItem, SplitRecord, Trip } from '@/types';
import { splitWithGifts } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { extrasTotal } from '@/utils/items';
import { generateJoinCode } from '@/utils/joinCode';
import {
  syncDeleteFriend, syncDeleteGroup, syncDeleteHome, syncDeleteHomePaymentsFor, syncDeleteSplitRecord,
  syncDeleteTrip, syncDeleteTripPaymentsFor, syncProfileCategories, syncUpsertFriend, syncUpsertGroup,
  syncUpsertHome, syncUpsertHomePayment, syncUpsertSplitRecord, syncUpsertTrip, syncUpsertTripPayment,
} from '@/lib/sync';

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

  setImage: (uri: string | null, base64: string | null) => void;
  setReceiptData: (data: ParsedReceipt) => void;
  updateItem: (id: string, name: string, price: number, quantity: number, category?: string) => void;
  addItemWithDetails: (name: string, price: number, quantity?: number, category?: string) => void;
  setItemCategory: (id: string, category: string | undefined) => void;
  addItemCategory: (cat: string) => void;
  removeItem: (id: string) => void;
  // Folds one line item into another (e.g. a separately-printed "Grilled Corn" into the steak it
  // came with): the source moves into the target's `extras` and its price is added to the target's.
  combineItems: (sourceId: string, targetId: string) => void;
  // Reverses combineItems for one extra: back to its own line, right after the item it was in.
  separateExtra: (itemId: string, extraId: string) => void;
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
  updateRecord: (id: string, patch: { restaurantName?: string; receiptDate?: string; receiptEndDate?: string; expenseCategory?: string; imageUri?: string }) => void;
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
    receiptEndDate?: string;
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
    receiptEndDate?: string;
    category: string | null;
    rawItems: Array<{ name: string; price: number; quantity: number }>;
    participants: string[];
    paidByName: string | null;
    tripId: string;
    currency?: string;
    imageUri?: string;
    coveredPeople?: string[];
    coveredBy?: string[];
  }) => void;
  startTripEntry: (tripId: string) => void;
  setActiveTripId: (id: string | null) => void;
}

// The parts of a saved bill derived from what's being edited — shared by saveSplit (a new
// record) and the subscription at the bottom of this file (keeping an already-saved bill in step).
type BillSource = Pick<SplitState, 'items' | 'people' | 'tax' | 'tip' | 'extraCharges' | 'restaurantName' | 'receiptDate' | 'imageUri' | 'paidBy' | 'payers' | 'currency'>;
function billContent(s: BillSource) {
  const { items, people, tax, tip, extraCharges, paidBy, payers } = s;
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  const extraTotal = extraCharges.reduce((sum, c) => sum + (c.isDiscount ? -c.amount : c.amount), 0);
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

  return {
    restaurantName: s.restaurantName || undefined,
    receiptDate: s.receiptDate || undefined,
    total,
    people: people.map((p) => p.name),
    itemCount: items.length,
    items: items.map((i) => ({ ...i })),
    fullPeople: people.map((p) => ({ ...p })),
    extraCharges: extraCharges.map((c) => ({ ...c })),
    tax,
    tip,
    imageUri: s.imageUri ?? undefined,
    paidById: paidBy ?? undefined,
    paidByName: paidBy ? (people.find((p) => p.id === paidBy)?.name) : undefined,
    personAmounts,
    currency: s.currency,
    // A single payer always covers the whole bill — recomputed so an edited total can't leave a
    // stale amount behind. Only a real multi-payer split keeps the amounts the user entered.
    payers: payers.length > 1 ? payers.map((p) => ({ ...p })) : (paidBy ? [{ personId: paidBy, amount: total }] : undefined),
  };
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

      setImage: (uri, base64) => {
        set({ imageUri: uri, imageBase64: base64 });
        // An already-saved bill keeps its receipt photo on the record, so rescanning or removing it
        // from an existing bill sticks.
        const { savedSplitId, updateRecord } = get();
        if (savedSplitId) updateRecord(savedSplitId, { imageUri: uri ?? undefined });
      },

      setReceiptData: (data) => {
        const items: ReceiptItem[] = data.items.map((i) => ({
          id: uid(),
          name: i.name,
          price: i.price,
          quantity: i.quantity ?? 1,
          assignedTo: [],
          ...(i.modifiers?.length ? { modifiers: i.modifiers } : {}),
        }));
        const extraCharges: ExtraCharge[] = (data.extraCharges ?? []).map((c) => ({
          id: uid(),
          name: c.name,
          amount: c.amount,
          ...(c.isDiscount ? { isDiscount: true } : {}),
        }));
        set({
          items,
          extraCharges,
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

      addItemCategory: (cat) => {
        set((s) => ({
          itemCategories: s.itemCategories.includes(cat) ? s.itemCategories : [...s.itemCategories, cat],
        }));
        syncProfileCategories({ itemCategories: get().itemCategories });
      },

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      combineItems: (sourceId, targetId) =>
        set((s) => {
          const source = s.items.find((i) => i.id === sourceId);
          if (!source || sourceId === targetId) return {};
          // Flatten: anything already added to the source comes along as its own extra, so every
          // extra stays separable on its own and extras never nest.
          const { extras: sourceExtras = [], ...sourceBase } = source;
          const sourceBasePrice = Math.round((source.price - extrasTotal(source)) * 100) / 100;
          return {
            items: s.items
              .filter((i) => i.id !== sourceId)
              .map((i) => i.id === targetId
                ? {
                    ...i,
                    price: Math.round((i.price + source.price) * 100) / 100,
                    extras: [...(i.extras ?? []), { ...sourceBase, price: sourceBasePrice }, ...sourceExtras],
                  }
                : i),
          };
        }),

      separateExtra: (itemId, extraId) =>
        set((s) => {
          const index = s.items.findIndex((i) => i.id === itemId);
          const item = s.items[index];
          const extra = item?.extras?.find((e) => e.id === extraId);
          if (!item || !extra) return {};
          const updated = {
            ...item,
            price: Math.round((item.price - extra.price) * 100) / 100,
            extras: item.extras!.filter((e) => e.id !== extraId),
          };
          const items = [...s.items];
          items.splice(index, 1, updated, extra);
          return { items };
        }),

      setItemOrder: (ids) =>
        set((s) => {
          const map = new Map(s.items.map((i) => [i.id, i]));
          return { items: ids.map((id) => map.get(id)!).filter(Boolean) };
        }),

      splitItemQty: (id) =>
        set((s) => {
          const item = s.items.find((i) => i.id === id);
          if (!item || item.quantity <= 1) return s;
          // Added extras stay on the first copy only, so their price is counted exactly once.
          const added = extrasTotal(item);
          const unitPrice = (item.price - added) / item.quantity;
          const copies = Array.from({ length: item.quantity }, (_, i) => ({
            ...item, id: uid(), quantity: 1, price: unitPrice + (i === 0 ? added : 0), assignedTo: [],
            extras: i === 0 ? item.extras : undefined,
          }));
          const idx = s.items.findIndex((i) => i.id === id);
          return { items: [...s.items.slice(0, idx), ...copies, ...s.items.slice(idx + 1)] };
        }),

      splitItemQtyAssigned: (id, assignees) =>
        set((s) => {
          const item = s.items.find((i) => i.id === id);
          if (!item || item.quantity <= 1) return s;
          const added = extrasTotal(item);
          const unitPrice = (item.price - added) / item.quantity;
          const copies = Array.from({ length: item.quantity }, (_, i) => ({
            ...item, id: uid(), quantity: 1, price: unitPrice + (i === 0 ? added : 0), assignedTo: assignees[i] ?? [],
            extras: i === 0 ? item.extras : undefined,
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
      setDefaultCurrency: (currency) => {
        set({ defaultCurrency: currency });
        syncProfileCategories({ defaultCurrency: currency });
      },

      reset: () => set({ ...initial, receiptDate: fmtDate(new Date()) }),

      saveSplit: () => {
        const state = get();
        const { people, splitSaved, savedSplitId, items, activeTripId, activeHomeId, expenseCategory } = state;
        // A bill opened from history is already saved and kept up to date as it's edited.
        if (splitSaved || savedSplitId || (items.length === 0 && people.length === 0)) return;

        const record: SplitRecord = {
          ...billContent(state),
          id: uid(),
          date: new Date().toISOString(),
          tripId: activeTripId ?? undefined,
          homeId: activeHomeId ?? undefined,
          expenseCategory: expenseCategory ?? undefined,
          status: 'open',
          paymentStatuses: people.map((p) => ({ personId: p.id, paid: false, amountPaid: 0 })),
          source: 'scan',
          joinCode: (!activeTripId && !activeHomeId) ? generateJoinCode() : undefined,
        };
        set((s) => ({ history: [record, ...s.history].slice(0, 50), splitSaved: true, savedSplitId: record.id }));
        syncUpsertSplitRecord(record);
      },

      clearHistory: () => set({ history: [] }),

      deleteHistory: (id) => {
        set((s) => ({ history: s.history.filter((r) => r.id !== id) }));
        syncDeleteSplitRecord(id);
      },

      updateRecord: (id, patch) => {
        const normalizedPatch = patch.receiptDate
          ? { ...patch, receiptDate: fmtDate(patch.receiptDate) || patch.receiptDate }
          : patch;
        set((s) => ({ history: s.history.map((r) => r.id === id ? { ...r, ...normalizedPatch } : r) }));
        const updated = get().history.find((r) => r.id === id);
        if (updated) syncUpsertSplitRecord(updated);
      },

      closeTab: (id) => {
        set((s) => ({ history: s.history.map((r) => (r.id === id ? { ...r, status: 'closed' } : r)) }));
        const updated = get().history.find((r) => r.id === id);
        if (updated) syncUpsertSplitRecord(updated);
      },

      reopenTab: (id) => {
        set((s) => ({ history: s.history.map((r) => (r.id === id ? { ...r, status: 'open' } : r)) }));
        const updated = get().history.find((r) => r.id === id);
        if (updated) syncUpsertSplitRecord(updated);
      },

      setPersonPaid: (tabId, personId, paid, amountPaid = 0) => {
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
        }));
        const updated = get().history.find((r) => r.id === tabId);
        if (updated) syncUpsertSplitRecord(updated);
      },

      addHome: (name, emoji, members, currency = DEFAULT_CURRENCY) => {
        const id = uid();
        const home: Home = { id, name, emoji, members, createdAt: new Date().toISOString(), currency, joinCode: generateJoinCode() };
        set((s) => ({ homes: [home, ...s.homes] }));
        syncUpsertHome(home);
        return id;
      },

      updateHome: (id, name, emoji, members, startDate, endDate) => {
        set((s) => ({
          homes: s.homes.map((h) => h.id === id
            ? { ...h, name, emoji, members, ...(startDate !== undefined && { createdAt: startDate }), endDate }
            : h),
        }));
        const updated = get().homes.find((h) => h.id === id);
        if (updated) syncUpsertHome(updated);
      },

      deleteHome: (id) => {
        const removedRecordIds = get().history.filter((r) => r.homeId === id).map((r) => r.id);
        set((s) => ({
          homes: s.homes.filter((h) => h.id !== id),
          history: s.history.filter((r) => r.homeId !== id),
          homePayments: (s.homePayments ?? []).filter((p) => p.homeId !== id),
        }));
        syncDeleteHome(id);
        removedRecordIds.forEach(syncDeleteSplitRecord);
        syncDeleteHomePaymentsFor(id);
      },

      closeHome: (id) => {
        set((s) => ({ homes: s.homes.map((h) => (h.id === id ? { ...h, status: 'closed' } : h)) }));
        const updated = get().homes.find((h) => h.id === id);
        if (updated) syncUpsertHome(updated);
      },
      reopenHome: (id) => {
        set((s) => ({ homes: s.homes.map((h) => (h.id === id ? { ...h, status: 'open' } : h)) }));
        const updated = get().homes.find((h) => h.id === id);
        if (updated) syncUpsertHome(updated);
      },

      saveHomeExpenseDirectly: ({ name, receiptDate, receiptEndDate, category, amount, participants, paidByName, homeId }) => {
        const n = participants.length || 1;
        const share = amount / n;
        const personIds = participants.map(() => uid());
        const personAmounts = participants.map((pName) => ({ name: pName, amount: share }));
        const record: SplitRecord = {
          id: uid(),
          date: new Date().toISOString(),
          restaurantName: name || undefined,
          receiptDate: receiptDate ? (fmtDate(receiptDate) || receiptDate) : undefined,
          receiptEndDate: receiptEndDate || undefined,
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
        syncUpsertSplitRecord(record);
      },

      addFriend: (name) => {
        const friend: Person = { id: uid(), name: name.trim() };
        set((s) => ({ friends: [...s.friends, friend] }));
        syncUpsertFriend(friend);
      },

      removeFriend: (id) => {
        set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
        syncDeleteFriend(id);
      },

      updateFriend: (id, name) => {
        set((s) => ({ friends: s.friends.map((f) => f.id === id ? { ...f, name: name.trim() } : f) }));
        const updated = get().friends.find((f) => f.id === id);
        if (updated) syncUpsertFriend(updated);
      },

      addGroup: (name, icon, members) => {
        const group: Group = { id: uid(), name, icon, members };
        set((s) => ({ groups: [...s.groups, group] }));
        syncUpsertGroup(group);
      },

      updateGroup: (id, name, icon, members) => {
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, name, icon, members } : g)),
        }));
        const updated = get().groups.find((g) => g.id === id);
        if (updated) syncUpsertGroup(updated);
      },

      deleteGroup: (id) => {
        set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
        syncDeleteGroup(id);
      },

      addTrip: (name, emoji, startDate, people, currency = DEFAULT_CURRENCY, currencies, budget, groupBudget) => {
        const id = uid();
        const currList = currencies && currencies.length > 0 ? currencies : [currency];
        const trip: Trip = { id, name, emoji, startDate, createdAt: new Date().toISOString(), people, status: 'open', currency: currList[0], currencies: currList, budget, groupBudget, joinCode: generateJoinCode() };
        set((s) => ({ trips: [trip, ...s.trips] }));
        syncUpsertTrip(trip);
        return id;
      },

      updateTrip: (id, name, emoji, startDate, endDate, people, currency, currencies, budget, groupBudget) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== id) return t;
            const currList = currencies && currencies.length > 0 ? currencies : (currency ? [currency] : t.currencies ?? [t.currency ?? 'USD']);
            return { ...t, name, emoji, startDate, endDate, people, currency: currList[0], currencies: currList, budget, groupBudget };
          }),
        }));
        const updated = get().trips.find((t) => t.id === id);
        if (updated) syncUpsertTrip(updated);
      },

      deleteTrip: (id) => {
        const removedRecordIds = get().history.filter((r) => r.tripId === id).map((r) => r.id);
        set((s) => ({
          trips: s.trips.filter((t) => t.id !== id),
          history: s.history.filter((r) => r.tripId !== id),
          tripPayments: s.tripPayments.filter((p) => p.tripId !== id),
        }));
        syncDeleteTrip(id);
        removedRecordIds.forEach(syncDeleteSplitRecord);
        syncDeleteTripPaymentsFor(id);
      },

      addTripPayment: (tripId, from, to, amount) => {
        const payment = { id: uid(), tripId, from, to, amount, date: new Date().toISOString() };
        set((s) => ({ tripPayments: [...s.tripPayments, payment] }));
        syncUpsertTripPayment(payment);
      },

      removeTripPaymentsFor: (tripId, from, to) => {
        set((s) => ({
          tripPayments: s.tripPayments.filter((p) => !(p.tripId === tripId && p.from === from && p.to === to)),
        }));
        syncDeleteTripPaymentsFor(tripId, from, to);
      },

      addHomePayment: (homeId, from, to, amount) => {
        const payment = { id: uid(), homeId, from, to, amount, date: new Date().toISOString() };
        set((s) => ({ homePayments: [...(s.homePayments ?? []), payment] }));
        syncUpsertHomePayment(payment);
      },

      removeHomePaymentsFor: (homeId, from, to) => {
        set((s) => ({
          homePayments: (s.homePayments ?? []).filter((p) => !(p.homeId === homeId && p.from === from && p.to === to)),
        }));
        syncDeleteHomePaymentsFor(homeId, from, to);
      },

      closeTrip: (id) => {
        set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, status: 'closed' } : t)) }));
        const updated = get().trips.find((t) => t.id === id);
        if (updated) syncUpsertTrip(updated);
      },

      reopenTrip: (id) => {
        set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, status: 'open' } : t)) }));
        const updated = get().trips.find((t) => t.id === id);
        if (updated) syncUpsertTrip(updated);
      },

      linkTabToTrip: (tabId, tripId) => {
        set((s) => ({
          history: s.history.map((r) => r.id === tabId ? { ...r, tripId } : r),
        }));
        const updated = get().history.find((r) => r.id === tabId);
        if (updated) syncUpsertSplitRecord(updated);
      },

      linkTabToHome: (tabId, homeId) => {
        set((s) => ({
          history: s.history.map((r) => r.id === tabId ? { ...r, homeId } : r),
        }));
        const updated = get().history.find((r) => r.id === tabId);
        if (updated) syncUpsertSplitRecord(updated);
      },

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

      addExpenseCategory: (cat) => {
        set((s) => ({
          expenseCategories: s.expenseCategories.includes(cat)
            ? s.expenseCategories
            : [...s.expenseCategories, cat],
        }));
        syncProfileCategories({ expenseCategories: get().expenseCategories });
      },

      updateExpenseCategory: (oldCat, newCat) => {
        set((s) => ({
          expenseCategories: s.expenseCategories.map((c) => c === oldCat ? newCat.trim() : c),
          history: s.history.map((r) => r.expenseCategory === oldCat ? { ...r, expenseCategory: newCat.trim() } : r),
        }));
        syncProfileCategories({ expenseCategories: get().expenseCategories });
      },

      removeExpenseCategory: (cat) => {
        set((s) => ({
          expenseCategories: s.expenseCategories.filter((c) => c !== cat),
        }));
        syncProfileCategories({ expenseCategories: get().expenseCategories });
      },

      addHomeExpenseCategory: (cat) => {
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.includes(cat)
            ? s.homeExpenseCategories
            : [...s.homeExpenseCategories, cat],
        }));
        syncProfileCategories({ homeExpenseCategories: get().homeExpenseCategories });
      },

      updateHomeExpenseCategory: (oldCat, newCat) => {
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.map((c) => c === oldCat ? newCat.trim() : c),
          history: s.history.map((r) => r.expenseCategory === oldCat ? { ...r, expenseCategory: newCat.trim() } : r),
        }));
        syncProfileCategories({ homeExpenseCategories: get().homeExpenseCategories });
      },

      removeHomeExpenseCategory: (cat) => {
        set((s) => ({
          homeExpenseCategories: s.homeExpenseCategories.filter((c) => c !== cat),
        }));
        syncProfileCategories({ homeExpenseCategories: get().homeExpenseCategories });
      },

      saveTripExpenseDirectly: ({ name, receiptDate, receiptEndDate, category, rawItems, participants, paidByName, tripId, currency: expCurrency, imageUri, coveredPeople, coveredBy }) => {
        if (rawItems.length === 0) return;
        const total = rawItems.reduce((s, i) => s + i.price, 0);
        const personIds = participants.map(() => uid());
        const gifted = coveredPeople?.length && coveredBy?.length ? { coveredPeople, coveredBy } : undefined;
        const personAmounts = splitWithGifts(total, participants, gifted?.coveredPeople, gifted?.coveredBy);
        const record: SplitRecord = {
          id: uid(),
          date: new Date().toISOString(),
          restaurantName: name || undefined,
          receiptDate: receiptDate ? (fmtDate(receiptDate) || receiptDate) : undefined,
          receiptEndDate: receiptEndDate || undefined,
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
          ...gifted,
          expenseCategory: category || undefined,
          status: 'open',
          currency: expCurrency ?? get().trips.find((t) => t.id === tripId)?.currency ?? 'USD',
          payers: paidByName
            ? [{ personId: personIds[participants.indexOf(paidByName)] ?? personIds[0], amount: total }]
            : undefined,
          // People treated as a gift owe nothing, so they start settled — otherwise the expense
          // could never close, since nobody would ever mark them paid.
          paymentStatuses: participants.map((pName, i) => ({ personId: personIds[i], paid: !!gifted?.coveredPeople.includes(pName), amountPaid: 0 })),
          source: 'manual',
        };
        set((s) => ({ history: [record, ...s.history].slice(0, 50) }));
        syncUpsertSplitRecord(record);
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
          savedSplitId: record.id,
        });
      },
    }),
    {
      name: 'split-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ history: state.history, groups: state.groups, trips: state.trips, tripPayments: state.tripPayments, homePayments: state.homePayments, homes: state.homes, friends: state.friends, expenseCategories: state.expenseCategories, homeExpenseCategories: state.homeExpenseCategories, itemCategories: state.itemCategories, defaultCurrency: state.defaultCurrency, imageUri: state.imageUri, imageBase64: state.imageBase64 }),
    },
  ),
);

// Keeps a bill that's already in history in step with edits made after opening it (items, people,
// tax/tip, payer…) — before this, those edits only lived in the in-progress state and were lost.
// Payment statuses carry over for people still on the bill; anyone newly added starts unpaid.
let billSyncTimer: ReturnType<typeof setTimeout> | null = null;
useSplitStore.subscribe((s, prev) => {
  // A new bill is saved the moment it has items (a scan lands, or the first one is typed in), so
  // backing out of the flow or jumping to another tab can't lose it — from then on the edits below
  // keep it current, and it can be reopened from the feed.
  if (!s.savedSplitId && !prev.savedSplitId && prev.items.length === 0 && s.items.length > 0) {
    s.saveSplit();
    return;
  }
  const id = s.savedSplitId;
  if (!id || id !== prev.savedSplitId) return; // nothing open, or the bill was just loaded
  if (s.items === prev.items && s.people === prev.people && s.tax === prev.tax && s.tip === prev.tip
    && s.extraCharges === prev.extraCharges && s.paidBy === prev.paidBy && s.payers === prev.payers
    && s.currency === prev.currency && s.restaurantName === prev.restaurantName
    && s.receiptDate === prev.receiptDate && s.imageUri === prev.imageUri) return;

  const content = billContent(s);
  useSplitStore.setState((st) => ({
    history: st.history.map((r) => {
      if (r.id !== id) return r;
      const statuses = r.paymentStatuses ?? [];
      const paymentStatuses = s.people.map((p) => statuses.find((ps) => ps.personId === p.id) ?? { personId: p.id, paid: false, amountPaid: 0 });
      return { ...r, ...content, paymentStatuses };
    }),
  }));
  // Typing a price fires an update per keystroke — only the last one needs to reach the server.
  if (billSyncTimer) clearTimeout(billSyncTimer);
  billSyncTimer = setTimeout(() => {
    const updated = useSplitStore.getState().history.find((r) => r.id === id);
    if (updated) syncUpsertSplitRecord(updated);
  }, 800);
});
