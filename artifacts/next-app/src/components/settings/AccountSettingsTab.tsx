import NextImage from "next/image";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function AccountSettingsTab() {
  const { user, logout } = useAuth();

  return (
    <section className="space-y-4">
      {user && (
        <div className="p-4 rounded-xl bg-background border border-panel-border flex items-center gap-3">
          {user.profileImageUrl ? (
            <NextImage src={user.profileImageUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" className="rounded-full shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium shrink-0">
              {(user.firstName || user.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      )}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </section>
  );
}
