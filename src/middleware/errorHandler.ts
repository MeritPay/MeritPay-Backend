import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    // Do not expose validation schema details in production
    res.status(400).json({ error: "Invalid request: validation failed" });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Conflict: record already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Generic Prisma error — do not expose details
    res.status(500).json({ error: "Database error" });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Invalid database request" });
    return;
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    console.error("Prisma panic:", (err as Error).message);
    res.status(500).json({ error: "Database error" });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser / http-errors style errors: honour the numeric status they carry.
  // Examples: entity.parse.failed -> 400, entity.too.large -> 413.
  // Only suppress logging for 4xx — genuine 5xx errors still fall through below.
  const bodyParserType = (err as any)?.type as string | undefined;
  const bodyParserStatus =
    (err as any)?.status ?? (err as any)?.statusCode;

  if (
    typeof bodyParserStatus === "number" &&
    bodyParserStatus >= 400 &&
    bodyParserStatus < 500
  ) {
    const message =
      bodyParserType === "entity.parse.failed"
        ? "Invalid JSON body"
        : bodyParserType === "entity.too.large"
        ? "Request body too large"
        : (err as Error).message || "Bad request";
    res.status(bodyParserStatus).json({ error: message });
    return;
  }

  if (err instanceof Error) {
    console.error("Unhandled error:", err.message);
  } else {
    console.error("Unknown error:", err);
  }
  res.status(500).json({ error: "Internal server error" });
}
