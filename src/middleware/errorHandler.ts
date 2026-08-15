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
    // Don't expose validation schema details in production
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
    // Generic Prisma error - don't expose details
    res.status(500).json({ error: "Database error" });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Invalid database request" });
    return;
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    console.error("Prisma panic:", err.message);
    res.status(500).json({ error: "Database error" });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof Error) {
    console.error("Unhandled error:", err.message);
  } else {
    console.error("Unknown error:", err);
  }
  res.status(500).json({ error: "Internal server error" });
}
