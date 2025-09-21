import type { ComponentProps, ComponentType, ReactNode } from "react";

declare module "@storybook/react" {
  export type Meta<C extends ComponentType<any> | unknown = unknown> = {
    title?: string;
    component?: C;
    args?: C extends ComponentType<any>
      ? Partial<ComponentProps<C>>
      : Record<string, unknown>;
    argTypes?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    tags?: string[];
    render?: (args: any) => ReactNode;
  } & Record<string, unknown>;

  export interface StoryContext<Args = Record<string, unknown>> {
    args: Args;
    canvasElement: HTMLElement;
    [key: string]: unknown;
  }

  export type PlayFunction<Args = Record<string, unknown>> = (
    context: StoryContext<Args>
  ) => unknown;

  export type StoryObj<M extends Meta<any> = Meta<any>> = {
    name?: string;
    args?: M extends { component?: infer C }
      ? C extends ComponentType<any>
        ? Partial<ComponentProps<C>>
        : Record<string, unknown>
      : Record<string, unknown>;
    render?: (args: any) => ReactNode;
    play?: PlayFunction<
      M extends { component?: infer C }
        ? C extends ComponentType<any>
          ? Partial<ComponentProps<C>>
          : Record<string, unknown>
        : Record<string, unknown>
    >;
    parameters?: Record<string, unknown>;
    decorators?: Array<(story: () => ReactNode) => ReactNode>;
    tags?: string[];
    [key: string]: unknown;
  };
}
