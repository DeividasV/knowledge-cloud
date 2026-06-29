# UI Component Prompt

Use this when adding or updating UI components in knowledge-cloud.

## Conventions

- This project uses **shadcn/ui with Base UI** (not Radix).
- `Button` does **not** support `asChild`. For link buttons, use `buttonVariants()` + `<Link>`.
- Prefer Tailwind CSS utility classes. Use `cn()` from `@/lib/utils` for conditional classes.
- Keep components in `components/` or `app/**/_components/`.
- Use `lucide-react` for icons.
- Client components must start with `"use client";`.

## Checklist

- [ ] Component is typed with TypeScript interfaces
- [ ] Props have sensible defaults where appropriate
- [ ] Uses existing shadcn/ui components from `components/ui/`
- [ ] Handles loading/error/empty states
- [ ] Responsive on mobile, tablet, and desktop
- [ ] `npm run lint -- --max-warnings=0` passes
- [ ] `npx tsc --noEmit` passes

## Example

```tsx
"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MyComponent({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
    >
      Go
    </Link>
  );
}
```
