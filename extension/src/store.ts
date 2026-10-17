import {
  configureStore,
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { analysisService } from "./services/analysisService";
import { chatGPTDemoCatalog } from "./services/modelCatalog";
import { normaliseLedger, type OptimisationLedger } from "./services/passiveTracking";
import {
  stableId,
  type PromptAnalysisResponse,
  type ModelRecommendationResponse,
  type PromptOptimisationResponse,
  type ResponseAnalysisRequest,
  type ResponseAnalysisResponse,
  type ModelCatalog,
} from "./services/contracts";
interface EcoState {
  prompt: string;
  status: "idle" | "loading" | "ready" | "error";
  analysis: PromptAnalysisResponse | null;
  error: string | null;
  activeRequestId: string | null;
  modelStatus: "idle" | "loading" | "ready" | "error";
  modelRecommendation: ModelRecommendationResponse | null;
  modelError: string | null;
  activeModelRequestId: string | null;
  optimisationStatus: "idle" | "loading" | "ready" | "error";
  optimisation: PromptOptimisationResponse | null;
  optimisationError: string | null;
  activeOptimisationRequestId: string | null;
  responseStatus: "idle" | "loading" | "ready" | "error";
  response: ResponseAnalysisResponse | null;
  responseError: string | null;
  activeResponseRequestId: string | null;
  history: HistoryItem[];
  savingActions: SavingAction[];
  responseHistory: ResponseAnalysisResponse[];
  optimisationLedger: OptimisationLedger;
  view: "overview" | "assistant";
  source: { tabId: number; url: string; draft: string; capturedAt?: number } | null;
}
export interface HistoryItem {
  id: string;
  at: number;
  analysis: PromptAnalysisResponse;
  optimisation: PromptOptimisationResponse | null;
  used: boolean;
  appliedAt: number | null;
}
export interface SavingAction {
  id: string;
  at: number;
  type: "rewrite" | "model";
  analysisId: string;
  estimatedWaterMl: number;
  estimatedEnergyWh: number;
  realisedWaterMl: number;
  realisedEnergyWh: number;
}
const initialState: EcoState = {
  prompt: "",
  status: "idle",
  analysis: null,
  error: null,
  activeRequestId: null,
  modelStatus: "idle",
  modelRecommendation: null,
  modelError: null,
  activeModelRequestId: null,
  optimisationStatus: "idle",
  optimisation: null,
  optimisationError: null,
  activeOptimisationRequestId: null,
  responseStatus: "idle",
  response: null,
  responseError: null,
  activeResponseRequestId: null,
  history: [],
  savingActions: [],
  responseHistory: [],
  optimisationLedger: normaliseLedger(null),
  view: "overview",
  source: null,
};
export const requestAnalysis = createAsyncThunk(
  "eco/analysePrompt",
  (prompt: string) =>
    analysisService.analysePrompt({ prompt, platform: "chatgpt", model: null }),
  {
    condition: (prompt, { getState }) => {
      const { eco } = getState() as RootState;
      return (
        Boolean(prompt.trim()) &&
        eco.analysis?.prompt !== prompt &&
        eco.status !== "loading"
      );
    },
  },
);
export const requestModel = createAsyncThunk(
  "eco/recommendModel",
  ({ prompt, analysisId, catalog }: { prompt: string; analysisId: string; catalog?: ModelCatalog }) =>
    analysisService.recommendModel({
      prompt,
      analysisId,
      platform: "chatgpt",
      model: null,
      catalog: catalog ?? chatGPTDemoCatalog,
    }),
);
export const requestOptimisation = createAsyncThunk(
  "eco/optimisePrompt",
  ({ prompt, analysisId }: { prompt: string; analysisId: string }) =>
    analysisService.optimisePrompt({
      prompt,
      analysisId,
      platform: "chatgpt",
      model: null,
    }),
);
export const requestResponseAnalysis = createAsyncThunk(
  "eco/analyseResponse",
  (request: ResponseAnalysisRequest) =>
    analysisService.analyseResponse(request),
);
const slice = createSlice({
  name: "eco",
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<Partial<EcoState>>) {
      const previousPrompt = state.prompt;
      Object.assign(state, action.payload, {
        status: action.payload.analysis ? "ready" : "idle",
        activeRequestId: null,
        modelStatus: action.payload.modelRecommendation ? "ready" : "idle",
        activeModelRequestId: null,
        optimisationStatus: action.payload.optimisation ? "ready" : "idle",
        activeOptimisationRequestId: null,
        responseStatus: action.payload.response ? "ready" : "idle",
        activeResponseRequestId: null,
      });
      if (state.prompt !== previousPrompt) {
        if (!action.payload.modelRecommendation) {
          state.modelRecommendation = null;
          state.modelStatus = "idle";
        }
        if (!action.payload.optimisation) {
          state.optimisation = null;
          state.optimisationStatus = "idle";
        }
      }
      if (!state.analysis && state.prompt) {
        const cached = state.history.find(
          (item) => item.id === stableId("prompt", state.prompt.trim()),
        );
        if (cached) {
          state.analysis = cached.analysis;
          state.status = "ready";
        }
      }
    },
    setPrompt(state, action: PayloadAction<string>) {
      if (state.prompt === action.payload) return;
      state.prompt = action.payload;
      const cached = state.history.find(
        (item) => item.id === stableId("prompt", action.payload.trim()),
      );
      state.analysis = cached?.analysis ?? null;
      state.status = cached ? "ready" : "idle";
      state.error = null;
      state.activeRequestId = null;
      state.modelRecommendation = null;
      state.modelStatus = "idle";
      state.modelError = null;
      state.activeModelRequestId = null;
      state.optimisation = null;
      state.optimisationStatus = "idle";
      state.optimisationError = null;
      state.activeOptimisationRequestId = null;
    },
    setView(state, action: PayloadAction<EcoState["view"]>) {
      state.view = action.payload;
    },
    markUsed(state) {
      const item = state.history.find((item) => item.id === state.analysis?.analysisId);
      if (item && state.optimisation?.analysisId === item.id) {
        item.used = true;
        item.appliedAt ??= Date.now();
        item.optimisation = state.optimisation;
      }
    },
    setOptimisationLedger(state, action: PayloadAction<OptimisationLedger>) {
      state.optimisationLedger = action.payload;
    },
    clearHistory(state) {
      state.history = [];
      state.savingActions = [];
      state.optimisationLedger = normaliseLedger(null);
      state.responseHistory = [];
      state.response = null;
      state.responseStatus = "idle";
    },
  },
  extraReducers(builder) {
    builder
      .addCase(requestAnalysis.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.activeRequestId = action.meta.requestId;
      })
      .addCase(requestAnalysis.fulfilled, (state, action) => {
        if (
          state.activeRequestId !== action.meta.requestId ||
          state.prompt !== action.meta.arg
        )
          return;
        state.status = "ready";
        state.analysis = action.payload;
        state.activeRequestId = null;
        if (
          !state.history.some((item) => item.id === action.payload.analysisId)
        ) {
          state.history.unshift({
            id: action.payload.analysisId,
            at: Date.now(),
            analysis: action.payload,
            optimisation: null,
            used: false,
            appliedAt: null,
          });
          state.history = state.history.slice(0, 100);
        }
      })
      .addCase(requestAnalysis.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId) return;
        state.status = "error";
        state.error =
          "Could not estimate this prompt. Retry by reopening Assistant.";
        state.activeRequestId = null;
      })
      .addCase(requestModel.pending, (state, action) => {
        state.modelStatus = "loading";
        state.modelError = null;
        state.activeModelRequestId = action.meta.requestId;
      })
      .addCase(requestModel.fulfilled, (state, action) => {
        if (
          state.activeModelRequestId !== action.meta.requestId ||
          state.analysis?.analysisId !== action.payload.analysisId
        )
          return;
        state.modelStatus = "ready";
        state.modelRecommendation = action.payload;
        state.activeModelRequestId = null;
      })
      .addCase(requestModel.rejected, (state, action) => {
        if (state.activeModelRequestId !== action.meta.requestId) return;
        state.modelStatus = "error";
        state.modelError = "Model guidance is unavailable. Try again.";
        state.activeModelRequestId = null;
      })
      .addCase(requestOptimisation.pending, (state, action) => {
        state.optimisationStatus = "loading";
        state.optimisationError = null;
        state.activeOptimisationRequestId = action.meta.requestId;
      })
      .addCase(requestOptimisation.fulfilled, (state, action) => {
        if (
          state.activeOptimisationRequestId !== action.meta.requestId ||
          state.analysis?.analysisId !== action.payload.analysisId
        )
          return;
        state.optimisationStatus = "ready";
        state.optimisation = action.payload;
        state.activeOptimisationRequestId = null;
        const item = state.history.find(
          (item) => item.id === action.payload.analysisId,
        );
        if (item) item.optimisation = action.payload;
      })
      .addCase(requestOptimisation.rejected, (state, action) => {
        if (state.activeOptimisationRequestId !== action.meta.requestId) return;
        state.optimisationStatus = "error";
        state.optimisationError = "Could not optimise this prompt. Try again.";
        state.activeOptimisationRequestId = null;
      })
      .addCase(requestResponseAnalysis.pending, (state, action) => {
        state.responseStatus = "loading";
        state.responseError = null;
        state.activeResponseRequestId = action.meta.requestId;
      })
      .addCase(requestResponseAnalysis.fulfilled, (state, action) => {
        if (state.activeResponseRequestId !== action.meta.requestId) return;
        state.responseStatus = "ready";
        state.response = action.payload;
        state.activeResponseRequestId = null;
        if (
          !state.responseHistory.some(
            (item) => item.analysisId === action.payload.analysisId,
          )
        ) {
          state.responseHistory.unshift(action.payload);
          state.responseHistory = state.responseHistory.slice(0, 100);
        }
      })
      .addCase(requestResponseAnalysis.rejected, (state, action) => {
        if (state.activeResponseRequestId !== action.meta.requestId) return;
        state.responseStatus = "error";
        state.responseError =
          "Response analysis is unavailable. Please try again.";
        state.activeResponseRequestId = null;
      });
  },
});
export const { hydrate, setPrompt, setView, markUsed, setOptimisationLedger, clearHistory } =
  slice.actions;
export const store = configureStore({ reducer: { eco: slice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export function selectTotals(state: RootState) {
  const { history, responseHistory, savingActions, optimisationLedger } = state.eco;
  const legacy = new Map<string, SavingAction>();
  for (const action of savingActions) {
    const prior = legacy.get(action.analysisId);
    if (!prior || prior.estimatedWaterMl < action.estimatedWaterMl) legacy.set(action.analysisId, action);
  }
  let waterSaved = optimisationLedger.waterMl;
  let energySaved = optimisationLedger.energyWh;
  for (const [key, action] of legacy) {
    const overlap = optimisationLedger.legacyOverlap[key];
    waterSaved += action.estimatedWaterMl - Math.min(action.estimatedWaterMl, overlap?.water ?? 0);
    energySaved += action.estimatedEnergyWh - Math.min(action.estimatedEnergyWh, overlap?.energy ?? 0);
  }
  return {
    analysed: history.length,
    projectedWaterMl: history.reduce((sum, item) => sum + item.analysis.estimates.waterMl, 0),
    projectedEnergyWh: history.reduce((sum, item) => sum + item.analysis.estimates.energyWh, 0),
    optimisationsMade: optimisationLedger.count,
    responses: responseHistory.length,
    potentialWaterMl: waterSaved,
    potentialEnergyWh: energySaved,
    realisedWaterMl: savingActions.reduce((total, action) => total + action.realisedWaterMl, 0),
    estimatedConsumedWaterMl: responseHistory.reduce(
      (total, item) => total + item.estimatedWaterMl,
      0,
    ),
  };
}
