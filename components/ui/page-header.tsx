import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import {
  pageHeaderActions,
  pageHeaderBreadcrumbs,
  pageHeaderDescription,
  pageHeaderInner,
  pageHeaderRoot,
  pageHeaderText,
  pageHeaderTitle,
} from "@/lib/design-system/components"
import { cn } from "@/lib/utils"

export type PageHeaderBreadcrumb = {
  label: string
  href?: string
}

type PageHeaderRootVariants = VariantProps<typeof pageHeaderRoot>
type PageHeaderInnerVariants = VariantProps<typeof pageHeaderInner>

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title">,
    PageHeaderRootVariants,
    Pick<PageHeaderInnerVariants, "align"> {
  title: string | React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: PageHeaderBreadcrumb[]
  actions?: React.ReactNode
  headingLevel?: HeadingTag
}

export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      title,
      description,
      breadcrumbs,
      actions,
      tone,
      density,
      align = "left",
      headingLevel = "h1",
      className,
      ...props
    },
    ref
  ) => {
    const headingId = React.useId()

    const Heading = headingLevel as React.ElementType

    const descriptionContent = React.useMemo(() => {
      if (!description) return null

      if (typeof description === "string") {
        return (
          <p className={cn(pageHeaderDescription({ density }))}>{description}</p>
        )
      }

      if (React.isValidElement(description)) {
        const element = description as React.ReactElement<{ className?: string }>;
        return React.cloneElement(element, {
          className: cn(pageHeaderDescription({ density }), element.props.className),
        })
      }

      return (
        <div className={cn(pageHeaderDescription({ density }))}>{description}</div>
      )
    }, [description, density])

    return (
      <header
        ref={ref}
        aria-labelledby={headingId}
        className={cn(pageHeaderRoot({ tone, density }), className)}
        data-align={align}
        {...props}
      >
        <div className={cn(pageHeaderInner({ density, align }))}>
          <div className={cn(pageHeaderText({ density, align }), "w-full")}>
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="w-full">
                <ol className={cn(pageHeaderBreadcrumbs({ density }))}>
                  {breadcrumbs.map((breadcrumb, index) => {
                    const isLast = index === breadcrumbs.length - 1

                    return (
                      <li
                        key={`${breadcrumb.label}-${index}`}
                        aria-current={isLast ? "page" : undefined}
                        className="flex items-center gap-2"
                      >
                        {breadcrumb.href && !isLast ? (
                          <a
                            href={breadcrumb.href}
                            className="rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {breadcrumb.label}
                          </a>
                        ) : (
                          <span
                            className={cn(
                              "rounded-md px-1 py-0.5",
                              isLast ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {breadcrumb.label}
                          </span>
                        )}
                        {!isLast ? (
                          <span aria-hidden="true" className="text-muted-foreground/70">
                            /
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              </nav>
            ) : null}

            <div className="flex flex-col gap-3">
              <Heading
                id={headingId}
                className={cn(pageHeaderTitle({ density }))}
              >
                {title}
              </Heading>
              {descriptionContent}
            </div>
          </div>

          {actions ? (
            <div
              className={cn(
                pageHeaderActions({ density }),
                align === "between" ? "md:justify-end" : "md:justify-start",
                "w-full md:w-auto"
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </header>
    )
  }
)

PageHeader.displayName = "PageHeader"
