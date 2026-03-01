import FamilyTree from "@/components/FamilyTree";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="theme-page min-h-screen">
      <header className="theme-header flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="theme-header-title text-xl font-semibold">
            Family Tree
          </h1>
          <p className="theme-header-subtitle mt-1 text-sm">
            Click cards to focus. Use edit and add buttons on each card.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <FamilyTree />
    </div>
  );
}
