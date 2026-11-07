import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CopyErrorButton } from "@/components/ui/copy-error-button"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, report, ...props }) {
        return (
          <Toast key={id} {...props} className={cn(report && "pr-16", props.className)}>
            <div className="grid gap-1" data-toast-text>
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            {report && (
              <CopyErrorButton
                context={report}
                className="absolute right-8 top-2 p-1 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50"
              />
            )}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
