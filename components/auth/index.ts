/**
 * Universal Authentication Components
 *
 * This module provides a complete set of standardized, reusable components
 * for authentication flows across the application.
 */

// Core template
export { AuthFlowTemplate } from "./AuthFlowTemplate";
export type { AuthFlowTemplateProps, FooterLink } from "./AuthFlowTemplate";

// State components
export { AuthLoadingState } from "./states/AuthLoadingState";
export type { AuthLoadingStateProps } from "./states/AuthLoadingState";

export { AuthSuccessState } from "./states/AuthSuccessState";
export type { AuthSuccessStateProps } from "./states/AuthSuccessState";

export { AuthErrorState } from "./states/AuthErrorState";
export type { AuthErrorStateProps } from "./states/AuthErrorState";

// Utility components
export { LoadingSpinner } from "./states/LoadingSpinner";

// Hooks (re-export from unified location)
export { useAuthState } from "@/hooks";
export type { AuthState, UseAuthStateOptions, UseAuthStateReturn } from "@/hooks";

export { useRedirect } from "./hooks/useRedirect";
export type { UseRedirectOptions, UseRedirectReturn } from "./hooks/useRedirect";

export { useErrorHandler } from "./hooks/useErrorHandler";
export type { UseErrorHandlerOptions, UseErrorHandlerReturn } from "./hooks/useErrorHandler";
