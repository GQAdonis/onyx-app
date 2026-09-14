"use client";

import { useTranslations } from "next-intl";
import { FiBook } from "react-icons/fi";

import { useDocumentSets } from "@/lib/hooks/useDocumentSets";
import { useSharedSearchFilters } from "@/lib/searchFilters/providers";
import SwitchList, { SwitchListItem } from "@/lib/tools/components/SwitchList";

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
 * Selections are keyed by NAME, matching `BaseFilters.document_set` on the wire
 * and the names the index stores. Ids are the storage currency on the backend.
 */
export default function DocumentSetsView({ onBack }: DocumentSetsViewProps) {
  const t = useTranslations("actions");
  const { documentSets } = useDocumentSets();
  const { selectedDocumentSets, setSelectedDocumentSets } =
    useSharedSearchFilters();

  const toggle = (name: string) =>
    setSelectedDocumentSets((prev: string[]) =>
      prev.includes(name)
        ? prev.filter((existing) => existing !== name)
        : [...prev, name]
    );

  const items: SwitchListItem[] = documentSets.map((documentSet) => ({
    id: String(documentSet.id),
    label: documentSet.name,
    description: documentSet.description || undefined,
    leading: <FiBook size={16} />,
    isEnabled: selectedDocumentSets.includes(documentSet.name),
    onToggle: () => toggle(documentSet.name),
  }));

  return (
    <SwitchList
      items={items}
      searchPlaceholder={t("toolsPopover.sourceFilters.searchPlaceholder")}
      allDisabled={selectedDocumentSets.length === 0}
      onDisableAll={() => setSelectedDocumentSets([])}
      onEnableAll={() =>
        setSelectedDocumentSets(documentSets.map((set) => set.name))
      }
      disableAllLabel={t("toolsPopover.disableAllSources.label")}
      enableAllLabel={t("toolsPopover.enableAllSources.label")}
      onBack={onBack}
    />
  );
}
