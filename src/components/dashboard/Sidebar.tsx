import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  IconDashboard,
  IconNotes,
  IconChartBar,
  IconQuestionMark,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { Avatar } from "@mui/material";

interface SidebarProps {
  user: any;
}

const mainLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <IconDashboard size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Practice Test",
    href: "/dashboard/practice-test",
    icon: <IconNotes size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <IconChartBar size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Review Questions",
    href: "/dashboard/review",
    icon: <IconQuestionMark size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
  },
];

export function DashboardSidebar({ user }: SidebarProps) {
  const getFirstLetter = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const bottomLinks = [
    {
      label: "Settings",
      href: "/dashboard/settings",
      icon: <IconSettings size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
    {
      label: user?.user_metadata?.first_name || user?.email || "",
      href: "/dashboard/profile",
      icon: (
        <Avatar sx={{ width: 20, height: 20, fontSize: "0.75rem" }}>
          {getFirstLetter(user?.user_metadata?.first_name || user?.email || "")}
        </Avatar>
      ),
    },
    {
      label: "Logout",
      href: "/signout",
      icon: <IconLogout size={24} className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
    },
  ];

  return (
    <Sidebar>
      <SidebarBody className="flex flex-col justify-between h-full">
        <div>
          {mainLinks.map((link) => (
            <SidebarLink key={link.href} link={link} />
          ))}
        </div>
        <div>
          {bottomLinks.map((link) => (
            <SidebarLink key={link.href} link={link} />
          ))}
        </div>
      </SidebarBody>
    </Sidebar>
  );
}