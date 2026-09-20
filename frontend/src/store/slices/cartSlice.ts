import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  TABLE_COOKIE,
  TABLE_SOURCE_COOKIE,
  deleteCookie,
  getCookie,
  setCookie,
} from "@/lib/cookies";

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  weightLabel: string | null;
  weightGrams: number | null;
  instructions: string[];
}

export type TableSource = "qr" | "manual";

export interface CartState {
  lines: CartLine[];
  tableNumber: number | null;
  tableSource: TableSource | null;
}

const STORAGE_KEY = "maatara-cart-v1";

const getInitialState = (): CartState => {
  if (typeof window === "undefined") {
    return { lines: [], tableNumber: null, tableSource: null };
  }
  let lines: CartLine[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) lines = JSON.parse(raw) as CartLine[];
  } catch {}

  let tableNumber: number | null = null;
  let tableSource: TableSource | null = null;
  const table = getCookie(TABLE_COOKIE);
  if (table && Number(table) > 0) {
    tableNumber = Number(table);
    tableSource = getCookie(TABLE_SOURCE_COOKIE) === "qr" ? "qr" : "manual";
  }

  return { lines, tableNumber, tableSource };
};

const initialState: CartState = getInitialState();

const syncStorage = (state: CartState) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines));
  }
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addLine: (state, action: PayloadAction<Omit<CartLine, "key">>) => {
      const line = action.payload;
      const key = `${line.productId}::${line.weightLabel ?? "std"}::${line.instructions.join("|")}`;
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        state.lines.push({ ...line, key });
      }
      syncStorage(state);
    },
    increment: (state, action: PayloadAction<string>) => {
      const existing = state.lines.find((l) => l.key === action.payload);
      if (existing) {
        existing.quantity += 1;
        syncStorage(state);
      }
    },
    decrement: (state, action: PayloadAction<string>) => {
      const index = state.lines.findIndex((l) => l.key === action.payload);
      if (index !== -1) {
        const line = state.lines[index];
        if (line) {
          if (line.quantity <= 1) {
            state.lines.splice(index, 1);
          } else {
            line.quantity -= 1;
          }
        }
        syncStorage(state);
      }
    },
    remove: (state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter((l) => l.key !== action.payload);
      syncStorage(state);
    },
    setInstructions: (
      state,
      action: PayloadAction<{ key: string; instructions: string[] }>,
    ) => {
      const existing = state.lines.find((l) => l.key === action.payload.key);
      if (existing) {
        existing.instructions = action.payload.instructions;
        syncStorage(state);
      }
    },
    clear: (state) => {
      state.lines = [];
      syncStorage(state);
    },
    setTableNumber: (
      state,
      action: PayloadAction<{ table: number | null; source?: TableSource }>,
    ) => {
      const { table, source = "manual" } = action.payload;
      state.tableNumber = table;
      state.tableSource = table == null ? null : source;
      if (typeof window !== "undefined") {
        if (table == null) {
          deleteCookie(TABLE_COOKIE);
          deleteCookie(TABLE_SOURCE_COOKIE);
        } else {
          setCookie(TABLE_COOKIE, String(table), 60 * 60 * 6);
          setCookie(TABLE_SOURCE_COOKIE, source, 60 * 60 * 6);
        }
      }
    },
  },
});

export const {
  addLine,
  increment,
  decrement,
  remove,
  setInstructions,
  clear,
  setTableNumber,
} = cartSlice.actions;
export default cartSlice.reducer;
