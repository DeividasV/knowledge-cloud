"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTagExtractionMethodSetting,
  setGeminiModelSetting,
  setOllamaMaxChunksSetting,
} from "@/app/actions/videos";
import { Loader2, BrainCircuit, Cloud, Zap, Layers } from "lucide-react";

const METHOD_OPTIONS = [
  { value: "ollama", label: "Ollama (local)", icon: BrainCircuit },
  { value: "gemini", label: "Gemini (cloud)", icon: Cloud },
];

const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

const OLLAMA_MAX_CHUNKS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20];

export function TagExtractionSettings({
  initialMethod,
  initialGeminiModel,
  initialOllamaMaxChunks,
}: {
  initialMethod: string;
  initialGeminiModel: string;
  initialOllamaMaxChunks: number;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [geminiModel, setGeminiModel] = useState(initialGeminiModel);
  const [ollamaMaxChunks, setOllamaMaxChunks] = useState(String(initialOllamaMaxChunks));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleMethodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setMethod(value);
    setSaved(false);
    startTransition(async () => {
      await setTagExtractionMethodSetting(value);
      setSaved(true);
      router.refresh();
    });
  }

  function handleGeminiModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setGeminiModel(value);
    setSaved(false);
    startTransition(async () => {
      await setGeminiModelSetting(value);
      setSaved(true);
      router.refresh();
    });
  }

  function handleOllamaMaxChunksChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setOllamaMaxChunks(value);
    setSaved(false);
    startTransition(async () => {
      await setOllamaMaxChunksSetting(Number(value));
      setSaved(true);
      router.refresh();
    });
  }

  const selectedMethod = METHOD_OPTIONS.find((o) => o.value === method);

  return (
    <div className="space-y-4">
      {/* Backend selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {selectedMethod && (
            <selectedMethod.icon className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium">Tag extraction backend</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={method}
            onChange={handleMethodChange}
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {saved && !isPending && (
            <span className="text-xs text-green-600">Saved</span>
          )}
        </div>
      </div>

      {/* Gemini model selector (only when Gemini is selected) */}
      {method === "gemini" && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Gemini model</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={geminiModel}
              onChange={handleGeminiModelChange}
              disabled={isPending}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {GEMINI_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {saved && !isPending && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
        </div>
      )}

      {/* Ollama max chunks (only when Ollama is selected) */}
      {method === "ollama" && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Ollama max chunks</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ollamaMaxChunks}
              onChange={handleOllamaMaxChunksChange}
              disabled={isPending}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {OLLAMA_MAX_CHUNKS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {saved && !isPending && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
