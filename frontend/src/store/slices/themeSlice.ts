import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark" | "auto";
export type ThemeBase = "amoled-black" | "minimalist" | "liquid-glass" | "claymorphism";

interface ThemeState {
  mode: ThemeMode;
  base: ThemeBase;
}

// Read from localStorage if available
const getInitialState = (): ThemeState => {
  if (typeof window === "undefined") {
    return { mode: "dark", base: "amoled-black" };
  }
  try {
    const stored = localStorage.getItem("maatara-theme-v1");
    if (stored) {
      return JSON.parse(stored) as ThemeState;
    }
  } catch {
    // ignore
  }
  return { mode: "dark", base: "amoled-black" }; // Project defaults to dark mode
};

const initialState: ThemeState = getInitialState();

export const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload;
      if (typeof window !== "undefined") {
        localStorage.setItem("maatara-theme-v1", JSON.stringify(state));
      }
    },
    setThemeBase: (state, action: PayloadAction<ThemeBase>) => {
      state.base = action.payload;
      if (typeof window !== "undefined") {
        localStorage.setItem("maatara-theme-v1", JSON.stringify(state));
      }
    },
  },
});

export const { setThemeMode, setThemeBase } = themeSlice.actions;
export default themeSlice.reducer;
