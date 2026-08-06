import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MortgageView } from "@/components/mortgage/mortgage-view";

export default async function HipotecaPage() {
  const { household } = await requireHousehold();

  const [mortgage, entries] = await Promise.all([
    prisma.mortgage.findUnique({ where: { householdId: household.id } }),
    prisma.mortgageEntry.findMany({
      where: { householdId: household.id },
      include: {
        attachments: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <MortgageView
      inviteCode={household.inviteCode}
      mortgage={
        mortgage
          ? {
              amount: mortgage.amount != null ? Number(mortgage.amount) : null,
              termYears: mortgage.termYears,
              interestRate:
                mortgage.interestRate != null
                  ? Number(mortgage.interestRate)
                  : null,
              bank: mortgage.bank,
              signedAt: mortgage.signedAt,
              notes: mortgage.notes,
            }
          : null
      }
      entries={entries.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        status: e.status,
        createdBy: e.createdBy,
        attachments: e.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
        })),
      }))}
    />
  );
}
