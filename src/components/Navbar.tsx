"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";

const Navbar: React.FC = () => {
  const [active, setActive] = React.useState<string | null>(null);

  return (
    <div className="fixed top-4 inset-x-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold">T</span>
            </div>
          </Link>

          <div className="flex-1 flex justify-center">
            <Menu setActive={setActive}>
              <MenuItem
                setActive={setActive}
                active={active}
                item="Certifications"
              >
                <div className="flex flex-col space-y-4 text-sm">
                  <HoveredLink href="/certifications/it">
                    IT Certifications
                  </HoveredLink>
                  <HoveredLink href="/certifications/finance">
                    Finance Certifications
                  </HoveredLink>
                  <HoveredLink href="/certifications/healthcare">
                    Healthcare Certifications
                  </HoveredLink>
                  <HoveredLink href="/certifications/project-management">
                    Project Management
                  </HoveredLink>
                </div>
              </MenuItem>
              {/* Add other MenuItem components here */}
            </Menu>
          </div>

          <div className="flex items-center space-x-2">
            <Link href="/signin">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;