import { LayoutGridIcon, ShoppingBagIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Composer } from "./panels";

const suggestions = ["Outfit for a tech event", "Black jeans under £80", "White trainers, fast delivery", "Summer wedding guest, under £300"];

// First screen: one question, one input, and a way back to what you already started
export function Home({
  composing,
  groupCount,
  bagCount,
  onPrompt,
  onGroups,
  onBags,
}: {
  composing: boolean;
  groupCount: number;
  bagCount: number;
  onPrompt: (prompt: string) => void;
  onGroups: () => void;
  onBags: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      <div className="m-auto flex w-full max-w-2xl flex-col items-center gap-8 px-5 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-heading text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95] font-bold tracking-tight text-balance">What are you shopping for?</h1>
          <p className="max-w-md text-balance text-muted-foreground">
            Describe an outfit or a single item. Fluid searches UK shops and builds a shop around it, with one bag for everything.
          </p>
        </div>
        <Composer hero placeholder="A look for Friday, or just black jeans" composing={composing} onPrompt={onPrompt} />
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Ideas">
          {suggestions.map((s) => (
            <li key={s}>
              <Button variant="outline" size="sm" className="rounded-full border-border" disabled={composing} onClick={() => onPrompt(s)}>
                {s}
              </Button>
            </li>
          ))}
        </ul>
        {(groupCount > 0 || bagCount > 0) && (
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {groupCount > 0 && (
              <Button variant="outline" size="lg" onClick={onGroups}>
                <LayoutGridIcon data-icon="inline-start" />
                Your groups ({groupCount})
              </Button>
            )}
            {bagCount > 0 && (
              <Button variant="outline" size="lg" onClick={onBags}>
                <ShoppingBagIcon data-icon="inline-start" />
                Your bags ({bagCount})
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
