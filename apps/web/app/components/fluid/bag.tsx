import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Separator } from "~/components/ui/separator";
import { byMerchant, gbp, returnsLine } from "~/lib/format";
import type { Piece } from "~/lib/types";
import { Photo } from "./piece";

export type BagLine = { piece: Piece; size: string | null };
export type Order = { merchant: string; ref: string; lines: BagLine[]; total: number; delivery: number | null; days: string | null };

// One bag per group. Each checks out on its own
export function Bags({
  groups,
  bags,
  orders,
  onRemove,
  onClear,
  onPlace,
}: {
  groups: { id: string; label: string }[];
  bags: Record<string, BagLine[]>;
  orders: Record<string, Order[]>;
  onRemove: (group: string, index: number) => void;
  onClear: (group: string) => void;
  onPlace: (group: string, orders: Order[]) => void;
}) {
  if (!groups.length)
    return (
      <Empty className="border-0 px-6 py-0">
        <EmptyHeader className="items-start text-left">
          <EmptyTitle className="font-heading">Your bags are empty</EmptyTitle>
          <EmptyDescription>Each group gets its own bag. Add a whole look from its total bar, or single pieces from their details.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="flex flex-col gap-10">
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3 px-6">
            <h3 className="min-w-0 flex-1 font-heading text-xl leading-tight font-bold first-letter:uppercase">{g.label}</h3>
            {(bags[g.id]?.length || orders[g.id]?.length) ? (
              <ClearButton label={g.label} onClear={() => onClear(g.id)} />
            ) : null}
          </div>
          <Bag lines={bags[g.id] ?? []} orders={orders[g.id] ?? []} onRemove={(i) => onRemove(g.id, i)} onPlace={(o) => onPlace(g.id, o)} />
        </section>
      ))}
    </div>
  );
}

// A group's bag across shops. Checkout splits it per shop and is simulated: no money moves
function Bag({ lines, orders, onRemove, onPlace }: { lines: BagLine[]; orders: Order[]; onRemove: (index: number) => void; onPlace: (orders: Order[]) => void }) {
  const [confirming, setConfirming] = useState(false);
  const shops = byMerchant(lines);
  const pieces = shops.reduce((sum, s) => sum + s.subtotal, 0);
  const delivery = shops.reduce((sum, s) => sum + (s.delivery ?? 0), 0);
  const count = `${shops.length} ${shops.length === 1 ? "order" : "orders"}`;

  const place = () => {
    onPlace(
      shops.map((s) => ({
        merchant: s.merchant,
        ref: `FL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        lines: s.lines,
        total: s.subtotal + (s.delivery ?? 0),
        delivery: s.delivery,
        days: s.lines[0].piece.ukDelivery?.days ?? null,
      })),
    );
    setConfirming(false);
  };

  return (
    <div className="flex flex-col gap-6 px-6 pb-8">
      {orders.length > 0 && (
        <Alert>
          <AlertTitle className="font-heading">Orders placed, simulated checkout</AlertTitle>
          <AlertDescription className="flex w-full flex-col gap-3 pt-2">
            {orders.map((o) => (
              <div key={o.ref} className="flex flex-col">
                <span className="flex justify-between font-heading text-base font-semibold text-foreground">
                  {o.merchant} <span className="tabular-nums">{gbp(o.total)}</span>
                </span>
                <span>
                  Order {o.ref}. {o.lines.length} {o.lines.length === 1 ? "piece" : "pieces"}. Preparing,{" "}
                  {o.days ? `arrives in ${o.days}` : "the shop emails tracking"}.
                </span>
              </div>
            ))}
            <span>No money moved.</span>
          </AlertDescription>
        </Alert>
      )}

      {!lines.length && !orders.length && <p className="text-sm text-muted-foreground">Nothing in this bag yet.</p>}

      {shops.map((s) => (
        <section key={s.merchant} aria-label={s.merchant} className="flex flex-col gap-3">
          <h4 className="flex items-baseline justify-between font-heading text-lg font-semibold">
            {s.merchant}
            <span className="tabular-nums">{gbp(s.subtotal + (s.delivery ?? 0))}</span>
          </h4>
          {s.lines.map((l) => {
            const index = lines.indexOf(l);
            return (
              <div key={index} className="flex items-start gap-3">
                <Photo piece={l.piece} className="w-16 shrink-0 [&_span]:hidden" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-heading leading-snug font-semibold">{l.piece.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {l.size ? `Size ${l.size}. ` : ""}
                    <span className="tabular-nums">{gbp(l.piece.price)}</span>
                  </span>
                  {l.piece.source === "mock" && <Badge variant="secondary">SAMPLE</Badge>}
                </div>
                {!confirming && (
                  <Button variant="ghost" size="sm" onClick={() => onRemove(index)} aria-label={`Remove ${l.piece.title}`}>
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground">
            {s.delivery === null ? `UK delivery unknown, check at ${s.merchant}` : s.delivery === 0 ? "Free UK delivery" : `UK delivery ${gbp(s.delivery)}`}.{" "}
            {returnsLine(s.lines[0].piece)}
          </p>
          <Separator />
        </section>
      ))}

      {lines.length > 0 && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Pieces</dt>
            <dd className="text-right tabular-nums">{gbp(pieces)}</dd>
            <dt className="text-muted-foreground">UK delivery</dt>
            <dd className="text-right tabular-nums">{gbp(delivery)}</dd>
            <dt className="self-end font-heading text-xl font-semibold">Total</dt>
            <dd className="text-right font-heading text-3xl font-semibold tabular-nums">{gbp(pieces + delivery)}</dd>
          </dl>
          {confirming ? (
            <>
              <p>This places {count}, one per shop. Checkout is simulated for the demo, no money moves.</p>
              <Button size="lg" onClick={place}>
                Confirm {count}, {gbp(pieces + delivery)}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Back to bag
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => setConfirming(true)}>
              Review {count}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Clearing takes two taps, the second one says what it does
function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(t);
  }, [sure]);
  return (
    <Button
      variant={sure ? "destructive" : "ghost"}
      size="sm"
      className="min-h-10"
      onClick={() => (sure ? onClear() : setSure(true))}
      aria-label={sure ? `Confirm clearing the bag for ${label}` : `Clear the bag for ${label}`}
    >
      {sure ? "Clear bag?" : "Clear"}
    </Button>
  );
}
