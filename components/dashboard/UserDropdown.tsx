"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, HelpCircle, MessageSquare, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";

export interface UserDropdownProps {
  className?: string;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ className }) => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Get user display name
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";
  
  // Get initials for avatar
  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const initials = getInitials();

  // Format username for display (lowercase with dots)
  const displayName = userName.toLowerCase().replace(/\s+/g, ".");

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSettings = () => {
    router.push("/dashboard/settings");
  };

  const handleHelp = () => {
    router.push("/faq");
  };

  const handleFeedback = () => {
    // TODO: Implement feedback modal or route
    window.open("mailto:support@testero.com?subject=Feedback", "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
          aria-label="User menu"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              backgroundColor: colorComponent.dashboard.userDropdown.avatarBg,
              color: colorComponent.dashboard.userDropdown.avatarText,
            }}
          >
            {initials}
          </div>
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        style={{
          minWidth: "200px",
          backgroundColor: colorComponent.dashboard.userDropdown.menuBg,
          borderColor: colorComponent.dashboard.userDropdown.menuBorder,
          boxShadow: `0 4px 6px -1px ${colorComponent.dashboard.userDropdown.menuShadow}`,
        }}
      >
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none" style={{ color: colorComponent.dashboard.userDropdown.itemText }}>
              {displayName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ backgroundColor: colorComponent.dashboard.userDropdown.divider }} />
        <DropdownMenuItem
          onClick={handleSettings}
          className="cursor-pointer"
          style={{
            color: colorComponent.dashboard.userDropdown.itemText,
          }}
        >
          <Settings className="mr-2 h-4 w-4" style={{ color: colorComponent.dashboard.userDropdown.itemIcon }} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleHelp}
          className="cursor-pointer"
          style={{
            color: colorComponent.dashboard.userDropdown.itemText,
          }}
        >
          <HelpCircle className="mr-2 h-4 w-4" style={{ color: colorComponent.dashboard.userDropdown.itemIcon }} />
          Help & FAQ
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleFeedback}
          className="cursor-pointer"
          style={{
            color: colorComponent.dashboard.userDropdown.itemText,
          }}
        >
          <MessageSquare className="mr-2 h-4 w-4" style={{ color: colorComponent.dashboard.userDropdown.itemIcon }} />
          Send Feedback
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ backgroundColor: colorComponent.dashboard.userDropdown.divider }} />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer"
          style={{
            color: colorComponent.dashboard.userDropdown.itemText,
          }}
        >
          <LogOut className="mr-2 h-4 w-4" style={{ color: colorComponent.dashboard.userDropdown.itemIcon }} />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

