import { z } from "zod";

const truckClassSchema = z.enum(["tray", "crane", "semi", "semiCrane"]);

const itemCodeSchema = z.string().trim().min(1).max(30).nullable();

const optionalItemCodeSchema = z
  .string()
  .trim()
  .max(30)
  .nullable()
  .transform((value) => value || null);

/** Up to this many mappings can be saved at once ("Accept all suggestions") */
const MAX_MAPPINGS = 500;

export const vehicleItemMappingsSchema = z.object({
  mappings: z
    .array(
      z.object({
        registration: z.string().trim().min(1).max(20),
        itemCode: itemCodeSchema,
      }),
    )
    .min(1)
    .max(MAX_MAPPINGS),
});

export const companyItemMappingsSchema = z.object({
  mappings: z
    .array(
      z.object({
        companyName: z.string().trim().min(1).max(200),
        truckClass: truckClassSchema,
        itemCode: itemCodeSchema,
      }),
    )
    .min(1)
    .max(MAX_MAPPINGS),
});

export const contactMappingsSchema = z.object({
  mappings: z
    .array(
      z.object({
        billTo: z.string().trim().min(1).max(200),
        contactId: z.string().trim().min(1).max(64).nullable(),
      }),
    )
    .min(1)
    .max(MAX_MAPPINGS),
});

export const xeroSettingsSchema = z.object({
  salesAccountCode: z.string().trim().min(1).max(10),
  taxType: z.string().trim().min(1).max(30),
  breakItemCode: optionalItemCodeSchema,
  eastlinkItemCode: optionalItemCodeSchema,
  citylinkItemCode: optionalItemCodeSchema,
  fuelLevyItemCode: optionalItemCodeSchema,
});
