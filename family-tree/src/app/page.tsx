import FamilyTree from "@/components/FamilyTree";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F6F0D7] text-[#89986D] dark:bg-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-[#9CAB84] bg-[#C5D89D]/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-[#89986D] dark:text-white">
            Family Tree
          </h1>
          <p className="mt-1 text-sm text-[#89986D]/90 dark:text-zinc-400">
            Click cards to focus. Use edit and add buttons on each card.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <FamilyTree />
    </div>
  );
}
