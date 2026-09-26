import { CheckIcon, StarIcon } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { deliveryLine, gbp, returnsLine, slotLabel, stockState } from "~/lib/format";
import type { Piece } from "~/lib/types";
import { cn } from "~/lib/utils";

export function Photo({ piece, className }: { piece: Piece; className?: string }) {
  // Some shops block photos served on other sites. A failed photo shows the no photo tile and marks itself so a card can hide
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div data-photo={piece.image && failed === piece.image ? "failed" : undefined} className={cn("relative aspect-[4/5] overflow-hidden bg-muted", className)}>
      {piece.image && failed !== piece.image ? (
        <img src={piece.image} alt={piece.title} loading="lazy" onError={() => setFailed(piece.image)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col justify-between p-4">
          <span className="font-heading text-lg leading-tight font-semibold text-balance">{piece.title}</span>
          <span className="text-sm text-muted-foreground">No photo from {piece.merchant}</span>
        </div>
      )}
    </div>
  );
}

// Changed figures ink in instead of sliding. The key remounts the span so the fade replays
export function Figure({ value, className }: { value: string; className?: string }) {
  return (
    <span key={value} className={cn("animate-in fade-in duration-300 ease-out motion-reduce:animate-none", className)}>
      {value}
    </span>
  );
}

export function Stock({ piece, size }: { piece: Piece; size: string | null }) {
  const state = stockState(piece, size ?? undefined);
  if (state === "IN STOCK" && piece.source === "live") return null;
  return (
    <div className="flex gap-1.5">
      {state === "UNKNOWN" ? (
        <Badge variant="outline">Sizes and stock at {piece.merchant}</Badge>
      ) : (
        state !== "IN STOCK" && (
          <Badge variant="secondary" className={cn(state === "GONE" && "line-through")}>
            {state === "LOW" ? "Few left" : state === "GONE" ? "Sold out" : state}
          </Badge>
        )
      )}
      {piece.source === "mock" && <Badge variant="outline">Sample</Badge>}
    </div>
  );
}

export function SizeSelect({ piece, size, onSize }: { piece: Piece; size: string | null; onSize: (s: string) => void }) {
  if (!piece.sizes.length && piece.source === "live") return <p className="text-sm text-muted-foreground">Sizes not listed by {piece.merchant}</p>;
  if (piece.sizes.length <= 1) return null;
  return (
    <Select value={size ?? ""} onValueChange={onSize}>
      <SelectTrigger aria-label={`Size for ${piece.title}`} className="h-10 w-full min-w-0 rounded-sm">
        <SelectValue placeholder="Size" />
      </SelectTrigger>
      <SelectContent>
        {piece.sizes.map((s) => (
          <SelectItem key={s.label} value={s.label} disabled={!s.available}>
            {s.label}
            {!s.available && " (sold out)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AddButton({ piece, size, onAdd, className }: { piece: Piece; size: string | null; onAdd: () => void; className?: string }) {
  const [added, setAdded] = useState(false);
  const needsSize = piece.sizes.length > 1 && !size;
  const gone = stockState(piece, size ?? undefined) === "GONE";
  return (
    <Button
      className={className}
      disabled={needsSize || gone || added}
      onClick={() => {
        onAdd();
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? (
        <>
          <CheckIcon data-icon="inline-start" />
          Added
        </>
      ) : gone ? (
        "Sold out"
      ) : needsSize ? (
        "Choose a size"
      ) : (
        "Add to bag"
      )}
    </Button>
  );
}

// Photos, facts and delivery from the shop, so the shopper can decide without leaving Fluid
export function Gallery({ piece, compact }: { piece: Piece; compact?: boolean }) {
  const images = piece.images?.length ? piece.images : piece.image ? [piece.image] : [];
  if (images.length <= 1) return compact ? null : <Photo piece={piece} />;
  if (compact)
    return (
      <div className="flex gap-1.5" aria-label={`More photos of ${piece.title}`}>
        {images.slice(1, 5).map((src) => (
          <img key={src} src={src} alt="" loading="lazy" className="aspect-[4/5] w-12 bg-muted object-cover" />
        ))}
      </div>
    );
  return (
    <Carousel opts={{ align: "start" }} className="w-full" aria-label={`Photos of ${piece.title}`}>
      <CarouselContent className="-ml-2">
        {images.map((src, i) => (
          <CarouselItem key={src} className="basis-full pl-2">
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <img src={src} alt={i === 0 ? piece.title : `${piece.title}, photo ${i + 1}`} loading={i ? "lazy" : "eager"} className="absolute inset-0 size-full object-cover" />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2 size-9 bg-background" />
      <CarouselNext className="right-2 size-9 bg-background" />
    </Carousel>
  );
}

export function Rating({ piece }: { piece: Piece }) {
  if (!piece.rating) return null;
  return (
    <span className="flex items-center gap-1 text-sm" aria-label={`Rated ${piece.rating.value} out of 5 from ${piece.rating.count} reviews`}>
      <StarIcon className="size-4 fill-foreground" aria-hidden />
      <span className="font-semibold">{piece.rating.value.toFixed(1)}</span>
      <span className="text-muted-foreground">({piece.rating.count} reviews)</span>
    </span>
  );
}

export function Description({ piece, clamp }: { piece: Piece; clamp?: boolean }) {
  const details = piece.details ?? [];
  if (!piece.description && !details.length) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {piece.description && <p className={cn("text-pretty", clamp && "line-clamp-3")}>{piece.description}</p>}
      {details.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
          {details.slice(0, clamp ? 3 : undefined).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PieceDetail({ piece, size, onSize, onAdd }: { piece: Piece; size: string | null; onSize: (s: string) => void; onAdd: () => void }) {
  const options = piece.deliveryOptions ?? [];
  const colours = piece.colours ?? [];
  return (
    <div className="flex flex-col gap-5 p-6 pt-0">
      <Gallery piece={piece} />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">
          {piece.brand && piece.brand !== piece.merchant ? `${piece.brand}, sold by ${piece.merchant}` : piece.merchant}
        </span>
        <h3 className="font-heading text-2xl leading-tight font-bold text-balance">{piece.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Figure value={gbp(piece.price)} className="font-heading text-2xl font-bold" />
          <Rating piece={piece} />
        </div>
        {piece.converted && (
          <span className="text-xs text-muted-foreground">
            Converted from {piece.converted.currency} {piece.converted.amount.toFixed(2)}
          </span>
        )}
        <Stock piece={piece} size={size} />
      </div>
      {piece.sizes.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="font-heading text-sm font-semibold">Size</span>
          <ToggleGroup type="single" variant="outline" spacing={1} value={size ?? ""} onValueChange={(v) => v && onSize(v)} aria-label={`Sizes for ${piece.title}`} className="flex-wrap">
            {piece.sizes.map((s) => (
              <ToggleGroupItem key={s.label} value={s.label} disabled={!s.available} aria-label={s.available ? s.label : `${s.label}, sold out`}>
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      <AddButton piece={piece} size={size} onAdd={onAdd} className="h-12 w-full text-base" />
      <Description piece={piece} />
      <Separator />
      <section aria-label="Delivery and returns" className="flex flex-col gap-3 text-sm">
        <h4 className="font-heading text-base font-bold">Delivery and returns</h4>
        {options.length ? (
          <ul className="flex flex-col gap-1.5">
            {options.map((o) => (
              <li key={o.name} className="flex justify-between gap-4">
                <span>
                  {o.name}
                  {o.days && <span className="text-muted-foreground">, {o.days}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{o.price === null ? "Price unknown" : o.price === 0 ? "Free" : gbp(o.price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{deliveryLine(piece)}</p>
        )}
        <p>{returnsLine(piece)}</p>
      </section>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {piece.colour && (
          <>
            <dt className="text-muted-foreground">Colour</dt>
            <dd className="capitalize">{piece.colour}</dd>
          </>
        )}
        {colours.length > 0 && (
          <>
            <dt className="text-muted-foreground">Also in</dt>
            <dd className="capitalize">{colours.join(", ")}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Category</dt>
        <dd>{slotLabel[piece.slot]}</dd>
        <dt className="text-muted-foreground">Checked</dt>
        <dd>
          {piece.source === "mock"
            ? "Sample piece, not from a real shop"
            : new Date(piece.fetchedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </dd>
      </dl>
      {piece.source === "live" && (
        <p className="text-xs text-muted-foreground">
          Details from{" "}
          <a href={piece.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {piece.merchant}
          </a>
          . Checkout happens here.
        </p>
      )}
    </div>
  );
}
