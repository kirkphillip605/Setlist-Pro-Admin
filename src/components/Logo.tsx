import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export const Logo = ({ className, iconOnly = false }: LogoProps) => {
  if (iconOnly) {
    return (
      <img 
        src="/setlist-icon.png" 
        alt="Setlist Pro Icon" 
        className={cn("h-8 w-auto", className)} 
      />
    );
  }

  return (
    <div className={cn("relative h-8 w-40", className)}>
      {/* Light Mode Logo */}
      <img 
        src="/setlist-logo-transparent.png" 
        alt="Setlist Pro" 
        className="absolute left-0 top-0 h-full w-auto object-contain dark:hidden" 
      />
      {/* Dark Mode Logo */}
      <img 
        src="/setlist-logo-dark.png" 
        alt="Setlist Pro" 
        className="absolute left-0 top-0 h-full w-auto object-contain hidden dark:block" 
      />
    </div>
  );
};