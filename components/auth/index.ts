/**
 * Universal Authentication Components
 *
 * This module provides a complete set of standardized, reusable components
 * for authentication flows across the application.
 */

// Core template
export { AuthFlowTemplate } from "./AuthFlowTemplate";
export type { AuthFlowTemplateProps, AuthState, FooterLink } from "./AuthFlowTemplate";

// State components
export { AuthLoadingState } from "./states/AuthLoadingState";
export type { AuthLoadingStateProps } from "./states/AuthLoadingState";

export { AuthSuccessState } from "./states/AuthSuccessState";
export type { AuthSuccessStateProps } from "./states/AuthSuccessState";

export { AuthErrorState } from "./states/AuthErrorState";
export type { AuthErrorStateProps } from "./states/AuthErrorState";

// Utility components
export { LoadingSpinner } from "./states/LoadingSpinner";

// Hooks
export { useAuthState } from "./hooks/useAuthState";
export type { AuthStateOptions, AuthStateReturn } from "./hooks/useAuthState";

export { useRedirect } from "./hooks/useRedirect";
export type { UseRedirectOptions, UseRedirectReturn } from "./hooks/useRedirect";

export { useErrorHandler } from "./hooks/useErrorHandler";
export type { UseErrorHandlerOptions, UseErrorHandlerReturn } from "./hooks/useErrorHandler";
