/**
 * Canonical React component entrypoints for the Testero design system.
 *
 * These exports intentionally point to the runtime implementations that live
 * under `components/ui` and `components/patterns`. Consolidating them in one
 * place allows feature code and codemods to consume primitives through a
 * stable, token-backed surface without reaching into ad-hoc paths.
 */

export { Button, type ButtonProps } from "@/components/ui/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  cardVariants,
  type CardProps,
} from "@/components/ui/card";
export { Badge, type BadgeProps, badgeVariants } from "@/components/ui/badge";
export { PageHeader, type PageHeaderProps } from "@/components/ui/page-header";
export { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state";
export { Table, type TableProps } from "@/components/ui/table";
export { Toast, type ToastProps } from "@/components/ui/toast";
export { Container, type ContainerProps } from "@/components/patterns/Container";
export { Section, type SectionProps } from "@/components/patterns/section";
