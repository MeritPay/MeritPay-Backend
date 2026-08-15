import { Router } from "express";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { listEmployeesQuerySchema, upsertEmployeeSchema } from "../lib/validation";

export const employeesRouter = Router();

// Upsert an employer's employee config (name, base salary, hours threshold, bonus rates).
employeesRouter.post("/employees", async (req, res, next) => {
  try {
    const body = upsertEmployeeSchema.parse(req.body);
    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only modify own employees
    if (body.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot modify other employers' employees");
    }

    const existing = await prisma.employee.findUnique({
      where: {
        employerWallet_employeeId: {
          employerWallet: body.employerWallet,
          employeeId: body.employeeId,
        },
      },
    });

    const employee = await prisma.employee.upsert({
      where: {
        employerWallet_employeeId: {
          employerWallet: body.employerWallet,
          employeeId: body.employeeId,
        },
      },
      create: body,
      update: body,
    });

    // Return 201 for new records, 200 for updates
    const status = existing ? 200 : 201;
    res.status(status).json(employee);
  } catch (err) {
    next(err);
  }
});

employeesRouter.get("/employees", async (req, res, next) => {
  try {
    const { employerWallet } = listEmployeesQuerySchema.parse(req.query);
    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only list own employees
    if (employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot list other employers' employees");
    }

    const employees = await prisma.employee.findMany({
      where: { employerWallet },
      orderBy: { employeeId: "asc" },
    });

    res.json(employees);
  } catch (err) {
    next(err);
  }
});

employeesRouter.delete("/employees/:id", async (req, res, next) => {
  try {
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new HttpError(404, "Employee not found");
    }

    const authenticatedWallet = res.locals.employerWallet;

    // Verify wallet authorization: can only delete own employees
    if (existing.employerWallet !== authenticatedWallet) {
      throw new HttpError(403, "Unauthorized: cannot delete other employers' employees");
    }

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
