"use client";

import { createContext, useContext } from "react";

import type {
  AttachmentsContext,
  PromptInputControllerProps,
} from "./types";

export const PromptInputController = createContext<PromptInputControllerProps | null>(
  null
);
export const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);
export const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

// Optional variants (do NOT throw). Useful for dual-mode components.
export const useOptionalPromptInputController = () =>
  useContext(PromptInputController);

export const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

