"use client";

import { useTranslations } from "next-intl";

import { SvgBook } from "@opal/icons";
import { useDocumentSets } from "@/lib/hooks/useDocumentSets";
import SwitchList, { SwitchListItem } from "@/lib/tools/components/SwitchList";
import { useToolsPopover } from "@/lib/tools/providers";

export interface DocumentSetsViewProps {
  onBack: () => void;
}

/**
 * The popover's document-sets sub-view: which knowledge this conversation
 * searches over.
 *
 * Deliberately *not* framed as filtering the assistant. A selection here
 * replaces the assistant's configured document sets for this conversation
 * rather than narrowing within them, so it can reach knowledge the assistant
 * was not configured with — bounded by the user's own access, which the backend
 * re-checks on every message. Selecting nothing falls back to the assistant's
 * own sets.
 *
 * The selection lives on the chat's tool configuration, beside the source
 * selection, so it is stored per chat and sent with every message.
 *
 * Selections are keyed by NAME, matching `BaseFilters.document_set` on the wire
 * and the names the index stores. Ids are the storage currency on the backend.
 */
export default function DocumentSetsView({ onBack }: DocumentSetsViewProps) {
  const t = useTranslations("actions");
  const { documentSets } = useDocumentSets();
  const { toolConfiguration } = useToolsPopover();
  const { filters, setFilters } = toolConfiguration;
  const selected = filters.documentSets;

  function setSelected(next: (current: readonly string[]) => string[]) {
    setFilters((current) => ({
      ...current,
      documentSets: next(current.documentSets),
    }));
  }

  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((existing) => existing !== name)
        : [...current, name]
    );
  }

  const items: SwitchListItem[] = documentSets.map((documentSet) => ({
    id: String(documentSet.id),
    label: documentSet.name,
    description: documentSet.description || undefined,
    leading: <SvgBook size={16} />,
    isEnabled: selected.includes(documentSet.name),
    onToggle: () => toggle(documentSet.name),
  }));

  return (
    <SwitchList
      items={items}
      searchPlaceholder={t("toolsPopover.sourceFilters.searchPlaceholder")}
      allDisabled={selected.length === 0}
      onDisableAll={() => setSelected(() => [])}
      onEnableAll={() => setSelected(() => documentSets.map((set) => set.name))}
      disableAllLabel={t("toolsPopover.disableAllSources.label")}
      enableAllLabel={t("toolsPopover.enableAllSources.label")}
      onBack={onBack}
    />
  );
}
