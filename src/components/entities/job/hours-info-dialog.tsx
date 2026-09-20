"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FIELDS = [
  {
    name: "Hours",
    detail:
      "Hours charged to the customer. Calculated from start and finish times when both are set.",
  },
  {
    name: "Travel Hours",
    detail:
      "Extra hours paid to the driver on top of the charged hours, and not billed to the customer.",
  },
  {
    name: "Deduction",
    detail:
      "Hours withheld from the driver, entered as a positive number. Leave blank when nothing is withheld.",
  },
  {
    name: "Driver Hours",
    detail:
      "Read-only. The hours the driver is paid for, worked out from the three fields above.",
  },
];

const EXAMPLES = [
  {
    hours: "8.00",
    travel: "1.00",
    deduction: "—",
    paid: "9.00",
    badge: "+1.00 driver",
  },
  {
    hours: "8.00",
    travel: "—",
    deduction: "1.00",
    paid: "7.00",
    badge: "-1.00 driver",
  },
  {
    hours: "8.00",
    travel: "2.00",
    deduction: "0.50",
    paid: "9.50",
    badge: "+1.50 driver",
  },
  {
    hours: "8.00",
    travel: "1.00",
    deduction: "1.00",
    paid: "8.00",
    badge: "-1.00 deducted",
  },
];

/**
 * Explains how charged, travel and deducted hours combine into the hours a
 * driver is paid. Opened from the jobs toolbar and the job form.
 */
export function HoursInfoDialog({
  id = "hours-info-btn",
  showLabel = false,
}: {
  id?: string;
  showLabel?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
      >
        {showLabel ? (
          <>
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            How hours work
          </>
        ) : (
          <Info className="h-3.5 w-3.5">
            <title>How hours work</title>
          </Info>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>How hours work</DialogTitle>
            <DialogDescription>
              What each hours field does, and how the driver&#39;s paid hours are
              worked out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <div className="rounded border bg-muted/40 px-3 py-2.5 font-mono text-xs">
              Driver Hours = Hours + Travel Hours − Deduction
            </div>

            <dl className="space-y-2.5">
              {FIELDS.map((field) => (
                <div key={field.name} className="grid gap-0.5">
                  <dt className="text-xs font-semibold">{field.name}</dt>
                  <dd className="text-xs text-muted-foreground">
                    {field.detail}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Examples</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-1.5 text-right font-medium">
                        Hours
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Travel
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Deduction
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        Driver paid
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        Badge on the jobs list
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {EXAMPLES.map((example) => (
                      <tr
                        key={`${example.hours}-${example.travel}-${example.deduction}`}
                        className="border-b last:border-0"
                      >
                        <td className="px-2 py-1.5 text-right">
                          {example.hours}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {example.travel}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {example.deduction}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {example.paid}
                        </td>
                        <td className="px-2 py-1.5 text-left">
                          {example.badge}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold">Badges on the jobs list</h4>
              <p className="text-xs text-muted-foreground">
                The badge under the Hours column shows the difference between the
                charged hours and what the driver is paid. Amber means the driver
                is paid more than the charged hours; red means hours were
                withheld. Hover a badge for the full breakdown.
              </p>
              <p className="text-xs text-muted-foreground">
                The third example above is paid 1.50 hours more than the charged
                hours, so the badge still reads +1.50 - but it is red, because
                0.50 hours were withheld.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold">On RCTIs and reports</h4>
              <p className="text-xs text-muted-foreground">
                A deduction is folded into the job&#39;s own line rather than
                appearing as a separate line, so the line is paid at the driver
                hours shown. Where hours have been withheld, the Total Driver
                Hours column also shows the amount deducted in brackets.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold">
                Jobs with no customer charge
              </h4>
              <p className="text-xs text-muted-foreground">
                Tick &quot;Driver only - no charge to the customer&quot; when the
                driver is paid for a job the customer is not billed for. Enter
                the hours as normal so the driver is paid: the tick records that
                nothing is charged, and the job shows a &quot;no charge&quot;
                badge under its hours on the jobs list.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              An over-sized deduction never pays negative hours - the driver
              hours stop at 0.00.
            </p>
          </div>

          <DialogFooter>
            <Button
              id="close-hours-info-btn"
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
