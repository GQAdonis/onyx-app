import { cn } from "@/lib/utils";

// Used for all admin page sections
export default function CardSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("p-6  bg-white border border-border-strong/80", className)}
    >
      {children}
    </div>
  );
}
