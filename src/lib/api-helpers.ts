import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@/lib/permissions";
import {
  apiRoute,
  handlePrismaWriteError,
  idParams,
  type RouteContext,
} from "@/lib/api-route";
import { secureWriteOperation, sanitizeWriteData } from "@/lib/write-security";
import { logActivity } from "@/lib/activity-logger";

type CrudRecord = { id: number } & Record<string, unknown>;

/**
 * The Prisma model delegate methods the CRUD handlers use. Prisma's generic
 * delegate signatures do not fit a shared type, so the model is narrowed to
 * this shape.
 */
type CrudModel = {
  findMany: (args: {
    orderBy: Record<string, string>;
  }) => Promise<CrudRecord[]>;
  findUnique: (args: { where: { id: number } }) => Promise<CrudRecord | null>;
  create: (args: { data: Record<string, unknown> }) => Promise<CrudRecord>;
  update: (args: {
    where: { id: number };
    data: Record<string, unknown>;
  }) => Promise<CrudRecord>;
  delete: (args: { where: { id: number } }) => Promise<unknown>;
};

const INVALID_ID_MESSAGE = "Invalid ID parameter";

/**
 * Creates standardised CRUD route handlers with security, validation and
 * activity logging. Reads and deletes go through apiRoute (rate limiting and
 * auth); creates and updates are validated by secureWriteOperation.
 * @returns Route handlers: list, create, getById, updateById, deleteById
 */
export function createCrudHandlers<TCreate, TUpdate>({
  model: prismaModel,
  createSchema,
  updateSchema,
  resourceType,
  tableName = resourceType,
  createTransform,
  updateTransform,
  listOrderBy = { createdAt: "desc" },
  beforeCreate,
  beforeUpdate,
  beforeDelete,
  restrictedFields,
}: {
  model: unknown;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<TUpdate>;
  resourceType: "job" | "customer" | "vehicle" | "driver" | "general";
  /** Table name for activity logging (e.g. 'Customer', 'Jobs') */
  tableName?: string;
  createTransform?: (data: TCreate) => Record<string, unknown>;
  updateTransform?: (data: TUpdate) => Record<string, unknown>;
  listOrderBy?: Record<string, string>;
  beforeCreate?: (args: { data: TCreate }) => Promise<NextResponse | null>;
  beforeUpdate?: (args: {
    id: number;
    data: TUpdate;
  }) => Promise<NextResponse | null>;
  beforeDelete?: (args: { id: number }) => Promise<NextResponse | null>;
  restrictedFields?: (args: { userRole: UserRole }) => readonly string[];
}) {
  const model = prismaModel as CrudModel;
  const idSchema = idParams({ message: INVALID_ID_MESSAGE });

  const forbiddenWriteFields = ({ userRole }: { userRole: UserRole }) => [
    "id",
    "createdAt",
    "updatedAt",
    ...(restrictedFields?.({ userRole }) ?? []),
  ];

  // GET /api/resource
  const list = apiRoute({
    auth: "user",
    errorMessage: `Error fetching ${resourceType} records`,
    handler: async () =>
      NextResponse.json(await model.findMany({ orderBy: listOrderBy })),
  });

  // POST /api/resource
  async function create(request: NextRequest) {
    const writeResult = await secureWriteOperation(request, {
      schema: createSchema,
      operation: "create",
      resourceType,
      requiresRole: "user",
    });
    if (!writeResult.success) return writeResult.error;

    const { data, userId, userRole } = writeResult;

    const sanitizedData = sanitizeWriteData(
      data as Record<string, unknown>,
      forbiddenWriteFields({ userRole }),
    );

    if (beforeCreate) {
      const hookResult = await beforeCreate({ data: sanitizedData as TCreate });
      if (hookResult) return hookResult;
    }
    const createData = createTransform
      ? createTransform(sanitizedData as TCreate)
      : sanitizedData;

    try {
      const result = await model.create({ data: createData });
      console.log(
        `SECURE CREATE: User ${userId} created ${resourceType} with ID ${result.id}`,
      );

      await logActivity({
        action: "CREATE",
        tableName,
        recordId: result.id.toString(),
        newData: result,
        request,
      });

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      console.error(`Error creating ${resourceType}:`, error);
      const conflict = handlePrismaWriteError({ error, resourceType });
      if (conflict) return conflict;
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  // GET /api/resource/[id]
  const getById = apiRoute({
    auth: "user",
    params: idSchema,
    errorMessage: `Error fetching ${resourceType}`,
    handler: async ({ params: { id } }) => {
      const record = await model.findUnique({ where: { id } });
      if (!record) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(record);
    },
  });

  // PUT /api/resource/[id]
  async function updateById(request: NextRequest, context: RouteContext) {
    const idResult = idSchema.safeParse(await context.params);
    if (!idResult.success) {
      return NextResponse.json({ error: INVALID_ID_MESSAGE }, { status: 400 });
    }
    const { id } = idResult.data;

    const writeResult = await secureWriteOperation(request, {
      schema: updateSchema,
      operation: "update",
      resourceType,
      requiresRole: "user",
    });
    if (!writeResult.success) return writeResult.error;

    const { data, userId, userRole } = writeResult;

    const sanitizedData = sanitizeWriteData(
      data as Record<string, unknown>,
      forbiddenWriteFields({ userRole }),
    );

    if (beforeUpdate) {
      const hookResult = await beforeUpdate({
        id,
        data: sanitizedData as TUpdate,
      });
      if (hookResult) return hookResult;
    }
    const updateData = updateTransform
      ? updateTransform(sanitizedData as TUpdate)
      : sanitizedData;

    try {
      const existingRecord = await model.findUnique({ where: { id } });
      if (!existingRecord) {
        return NextResponse.json(
          { error: `${resourceType} not found` },
          { status: 404 },
        );
      }

      // Prevent editing an archived record. Restoring it (setting
      // isArchived: false) is still permitted. No-op for models without
      // an isArchived field.
      const isArchived = existingRecord.isArchived === true;
      const isUnarchiving = updateData.isArchived === false;
      if (isArchived && !isUnarchiving) {
        return NextResponse.json(
          {
            error: `This ${resourceType} is archived and cannot be edited. Restore it first.`,
          },
          { status: 409 },
        );
      }

      const result = await model.update({ where: { id }, data: updateData });
      console.log(
        `SECURE UPDATE: User ${userId} updated ${resourceType} ID ${id}`,
      );

      await logActivity({
        action: "UPDATE",
        tableName,
        recordId: id.toString(),
        oldData: existingRecord,
        newData: result,
        request,
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error(`Error updating ${resourceType}:`, error);
      const conflict = handlePrismaWriteError({ error, resourceType });
      if (conflict) return conflict;
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  }

  // DELETE /api/resource/[id]
  const deleteById = apiRoute({
    auth: {
      roles: ["admin", "manager"],
      forbiddenMessage:
        "Forbidden - Manager or Admin role required for delete operations",
    },
    params: idSchema,
    errorMessage: `Error deleting ${resourceType}`,
    handler: async ({ request, userId, userRole, params: { id } }) => {
      if (beforeDelete) {
        const hookResult = await beforeDelete({ id });
        if (hookResult) return hookResult;
      }

      const existingRecord = await model.findUnique({ where: { id } });
      if (!existingRecord) {
        return NextResponse.json(
          { error: `${resourceType} not found` },
          { status: 404 },
        );
      }

      await model.delete({ where: { id } });
      console.log(
        `SECURE DELETE: User ${userId} (${userRole}) deleted ${resourceType} ID ${id}`,
      );

      await logActivity({
        action: "DELETE",
        tableName,
        recordId: id.toString(),
        oldData: existingRecord,
        request,
      });

      return NextResponse.json({ success: true });
    },
  });

  return { list, create, getById, updateById, deleteById };
}
