import { ArrowUpIcon, LogOutIcon, PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "~/components/ui/input-group";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import type { Group, Storefront } from "~/lib/store";
import { cn } from "~/lib/utils";
import { kindLabel } from "./sheet";

// The one input. Big and centred on the home screen, docked under a group
export function Composer({
  placeholder,
  composing,
  onPrompt,
  hero,
}: {
  placeholder: string;
  composing: boolean;
  onPrompt: (prompt: string) => void;
  hero?: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const prompt = draft.trim();
        if (!prompt || composing) return;
        setDraft("");
        onPrompt(prompt);
      }}
    >
      <InputGroup className={cn("rounded-full bg-background pl-2 has-disabled:bg-background has-disabled:opacity-100 dark:bg-background", hero ? "h-16 shadow-[0_4px_20px_rgba(0,0,0,0.08)]" : "h-13")}>
        <InputGroupInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label="What are you shopping for"
          disabled={composing}
          autoFocus={hero}
          className={hero ? "text-lg" : "text-base"}
        />
        <InputGroupAddon align="inline-end" className="pr-2">
          <InputGroupButton
            type="submit"
            variant="default"
            size={hero ? "sm" : "icon-sm"}
            className={cn("rounded-full", hero ? "h-11 px-5" : "size-9")}
            disabled={composing || !draft.trim()}
            aria-label="Shop"
          >
            {composing ? <Spinner /> : hero ? "Shop" : <ArrowUpIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

// Left panel. Hide it with the toggle in the header or Cmd B
export function AppSidebar({
  groups,
  activeId,
  bagCount,
  storefront,
  email,
  onOpenGroup,
  onRemoveGroup,
  onNew,
  onCustomise,
  onSignOut,
}: {
  groups: Group[];
  activeId: string | null;
  bagCount: (id: string) => number;
  storefront: string | null;
  email: string;
  onOpenGroup: (g: Group) => void;
  onRemoveGroup: (g: Group) => void;
  onNew: () => void;
  onCustomise: () => void;
  onSignOut: () => void;
}) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3 px-4 pt-5">
        <button type="button" onClick={onNew} className="cursor-pointer self-start font-numeral text-4xl leading-none font-extrabold tracking-tight">
          Fluid
        </button>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onNew} isActive={!activeId} className="font-heading font-semibold">
              <PlusIcon />
              New search
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Your groups</SidebarGroupLabel>
          <SidebarGroupContent>
            {groups.length ? (
              <SidebarMenu>
                {groups.map((g) => {
                  const count = bagCount(g.id);
                  return (
                    <SidebarMenuItem key={g.id}>
                      <SidebarMenuButton size="lg" isActive={g.id === activeId} onClick={() => onOpenGroup(g)} className="h-auto py-2">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-heading font-semibold first-letter:uppercase">{g.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {kindLabel(g)}, {Object.keys(g.pieces).length} pieces
                          </span>
                        </span>
                      </SidebarMenuButton>
                      {count > 0 && (
                        <SidebarMenuBadge aria-label={`${count} in bag`} className="right-9 -translate-y-1/2 peer-data-[size=lg]/menu-button:top-1/2">
                          {count}
                        </SidebarMenuBadge>
                      )}
                      <SidebarMenuAction
                        showOnHover
                        onClick={() => onRemoveGroup(g)}
                        aria-label={`Remove ${g.name} and its bag`}
                        className="right-2 size-7 w-7 -translate-y-1/2 peer-data-[size=lg]/menu-button:top-1/2"
                      >
                        <Trash2Icon />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">Every search becomes a group with its own bag. They show up here.</p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Storefront</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onCustomise}>
                  <Settings2Icon />
                  <span className="truncate">{storefront ? `Storefronts, this look is ${storefront}` : "Save or reuse a look"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{email}</span>
          <Button variant="ghost" size="icon-sm" onClick={onSignOut} aria-label="Sign out">
            <LogOutIcon />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// Saved storefronts. Jev can restyle the open group like one, and the agent reuses one for similar requests
export function StorefrontPanel({
  current,
  storefronts,
  canSave,
  forSearches,
  onSave,
  onApply,
  onChoose,
  onRemove,
}: {
  current: string | null;
  storefronts: Storefront[];
  canSave: boolean;
  forSearches: string | null;
  onSave: (name: string) => void;
  onApply: (s: Storefront) => void;
  onChoose: (id: string | null) => void;
  onRemove: (s: Storefront) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-6 px-6 pb-8">
      <p className="text-sm text-muted-foreground">
        Change how a group looks by asking in the search bar, like "show each category as a carousel", "add a buy button to each item" or "dark mode". Save the look, then use it here or for every new search: the products Fluid finds load straight into it.
      </p>
      {current && <p className="text-sm">Current look: {current}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave(name.trim());
          setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this look" aria-label="Storefront name" className="h-10" disabled={!canSave} />
        <Button type="submit" variant="outline" disabled={!canSave || !name.trim()}>
          Save
        </Button>
      </form>
      {!canSave && <p className="text-sm text-muted-foreground">Open a group to save how it looks.</p>}
      {storefronts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-heading text-sm font-semibold">Saved storefronts</span>
          <ul className="flex flex-col gap-2">
            {storefronts.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-heading font-semibold">{s.name}</span>
                <Button variant="outline" size="sm" disabled={!canSave} onClick={() => onApply(s)}>
                  Use here
                </Button>
                <Button variant={forSearches === s.id ? "default" : "outline"} size="sm" onClick={() => onChoose(forSearches === s.id ? null : s.id)} aria-pressed={forSearches === s.id}>
                  {forSearches === s.id ? "Used for new searches" : "Use for new searches"}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(s)} aria-label={`Delete ${s.name}`}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
