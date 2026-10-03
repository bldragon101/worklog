"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import { vehicleSelectOptionsQuery } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import type { UnknownTollTag } from "@/lib/tolls/toll-types";

function UnknownTagRow({
  tag,
  onAssigned,
}: {
  tag: UnknownTollTag;
  onAssigned: () => void;
}) {
  const [registration, setRegistration] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registration.trim()) return;

    setIsSaving(true);
    try {
      const result = await fetchJson<{ registration: string; updatedTrips: number }>({
        url: "/api/tolls/tags",
        init: {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagNumber: tag.tagNumber, registration }),
        },
        fallbackMessage: "Failed to assign toll tag",
      });
      toast({
        title: "Toll tag assigned",
        description: `Tag ${tag.tagNumber} is now ${result.registration} (${result.updatedTrips} trips updated).`,
        variant: "success",
      });
      onAssigned();
    } catch (error) {
      console.error("Error assigning toll tag:", error);
      toast({
        title: "Failed to assign toll tag",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const inputId = `toll-tag-${tag.tagNumber}-registration-input`;

  return (
    <tr className="border-b">
      <td className="px-4 py-2 font-mono text-sm">{tag.tagNumber}</td>
      <td className="px-4 py-2 font-mono text-sm text-right">{tag.tripCount}</td>
      <td className="px-4 py-2 font-mono text-sm text-right">
        {formatCurrency({ amount: tag.amount })}
      </td>
      <td className="px-4 py-2 font-mono text-sm">
        {tag.lastSeen ? formatDateDDMMYYYY({ isoString: tag.lastSeen }) : ""}
      </td>
      <td className="px-4 py-2">
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <label htmlFor={inputId} className="sr-only">
            Registration for tag {tag.tagNumber}
          </label>
          <Input
            id={inputId}
            list="toll-tag-registration-options"
            value={registration}
            onChange={(event) => setRegistration(event.target.value.toUpperCase())}
            placeholder="Registration"
            className="h-8 w-36 font-mono rounded"
          />
          <Button
            id={`toll-tag-${tag.tagNumber}-assign-btn`}
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 rounded"
            disabled={isSaving || !registration.trim()}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Assign
          </Button>
        </form>
      </td>
    </tr>
  );
}

export function UnknownTagsPanel({
  tags,
  onAssigned,
}: {
  tags: UnknownTollTag[];
  onAssigned: () => void;
}) {
  const { data: vehicleOptions } = useQuery(vehicleSelectOptionsQuery);

  if (tags.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Every toll tag is linked to a registration.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <p className="px-4 pt-4 pb-2 text-sm text-muted-foreground">
        These tags have only been seen without a number plate in the Linkt
        export, so their trips cannot be matched to jobs. Assign the vehicle
        each tag belongs to. Tags seen with a plate are linked automatically on
        import.
      </p>
      <datalist id="toll-tag-registration-options">
        {(vehicleOptions?.registrationOptions ?? []).map((registration) => (
          <option key={registration} value={registration} />
        ))}
      </datalist>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2 font-medium">Tag</th>
            <th className="px-4 py-2 font-medium text-right">Trips</th>
            <th className="px-4 py-2 font-medium text-right">Amount</th>
            <th className="px-4 py-2 font-medium">Last seen</th>
            <th className="px-4 py-2 font-medium">Registration</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <UnknownTagRow key={tag.tagNumber} tag={tag} onAssigned={onAssigned} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
