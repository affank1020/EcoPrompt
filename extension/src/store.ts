import { configureStore, createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { analyzePrompt, type Analysis } from './mockApi';
import type { SaveResult } from './syncState';

export const requestAnalysis = createAsyncThunk('eco/analyze', analyzePrompt);

interface EcoState {
  prompt: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  panelOpen: boolean;
  enabled: boolean;
  analysis: Analysis | null;
  error: string | null;
  activeRequestId: string | null;
  // The last estimate this tab sent to be saved, for the widget's status line.
  lastSave: { id: string; state: SaveResult | 'saving' } | null;
}

const initialState: EcoState = {
  prompt: '',
  status: 'idle',
  panelOpen: false,
  enabled: true,
  analysis: null,
  error: null,
  activeRequestId: null,
  lastSave: null,
};

const slice = createSlice({
  name: 'eco',
  initialState,
  reducers: {
    setPrompt(state, action: PayloadAction<string>) {
      if (state.prompt === action.payload) return;
      state.prompt = action.payload;
      state.status = 'idle';
      state.analysis = null; // Never show data belonging to an older prompt.
      state.activeRequestId = null;
      state.error = null;
    },
    setPanelOpen(state, action: PayloadAction<boolean>) {
      state.panelOpen = action.payload;
    },
    setLastSave(state, action: PayloadAction<EcoState['lastSave']>) {
      state.lastSave = action.payload;
    },
    setEnabled(state, action: PayloadAction<boolean>) {
      state.enabled = action.payload;
      if (!action.payload) {
        state.status = 'idle';
        state.analysis = null;
        state.activeRequestId = null;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(requestAnalysis.pending, (state, action) => {
        state.status = 'loading';
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(requestAnalysis.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId || state.prompt !== action.meta.arg || !state.enabled) return;
        state.status = 'ready';
        state.analysis = action.payload;
        state.activeRequestId = null;
      })
      .addCase(requestAnalysis.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId) return;
        state.status = 'error';
        state.error = action.error.message ?? 'Analysis unavailable';
        state.activeRequestId = null;
      });
  },
});

export const { setPrompt, setPanelOpen, setEnabled, setLastSave } = slice.actions;

export const store = configureStore({ reducer: { eco: slice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
