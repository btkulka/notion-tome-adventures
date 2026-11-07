import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { CopyErrorButton } from "@/components/ui/copy-error-button"
import { captureErrorContext } from "@/lib/error-report"
import { keepAcrossHmr } from "@/lib/hmr"

// Every toast.error gets a copy button for its message and stack trace. Patched
// here, once, so callers keep importing toast straight from sonner. A caller that
// sets its own action keeps it and goes without.
keepAcrossHmr(import.meta.hot, "errorToastCopy", () => {
  const raise = toast.error
  toast.error = (message, data) =>
    raise(message, data?.action ? data : { ...data, action: <CopyErrorButton context={captureErrorContext()} className="ml-auto h-7 w-7" /> })
  return true
})

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
