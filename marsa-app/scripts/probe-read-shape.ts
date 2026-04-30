/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";

// Diagnostic — compare legacy vs adapter output for the existing
// ProjectDocument rows so we can sign off on Phase C field-by-field
// before flipping any other endpoints.

import { recordItemToProjectDocument } from "../src/lib/record-shape-adapter";

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const legacy = await prisma.projectDocument.findMany({
    include: {
      documentType: {
        include: { group: { select: { id: true, name: true, displayOrder: true } } },
      },
      uploadedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true, order: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const records = await prisma.projectRecordItem.findMany({
    where: { deletedAt: null, title: { contains: "[PD:" } },
    include: {
      documentType: {
        include: { group: { select: { id: true, name: true, displayOrder: true } } },
      },
      uploadedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true, order: true } },
    },
  });

  console.log(`legacy=${legacy.length}, records=${records.length}\n`);

  let mismatches = 0;
  for (const orig of legacy) {
    const ri = records.find((r: any) => r.title.includes(`[PD:${orig.id}]`));
    if (!ri) {
      console.log(`❌ no mirror for ${orig.id}`);
      mismatches++;
      continue;
    }
    const adapted = recordItemToProjectDocument(ri as any) as any;

    const compare = [
      "id",
      "kind",
      "fileUrl",
      "textData",
      "uploadedOnBehalfOfClient",
      "status",
      "rejectionReason",
      "isSharedWithClient",
      "version",
      "projectId",
      "documentTypeId",
      "uploadedById",
      "reviewedById",
      "partnerId",
    ];
    const diffs: string[] = [];
    for (const k of compare) {
      const a = (orig as any)[k];
      const b = adapted[k];
      // tolerate nullish equivalence
      const eq =
        (a == null && b == null) ||
        (a instanceof Date && b instanceof Date && a.getTime() === b.getTime()) ||
        a === b;
      if (!eq) diffs.push(`${k}: legacy=${JSON.stringify(a)} adapted=${JSON.stringify(b)}`);
    }
    // documentType, uploadedBy, partner are nested objects — compare ids only
    const nestedCompare: { f: string; sub: string }[] = [
      { f: "documentType", sub: "id" },
      { f: "uploadedBy", sub: "id" },
      { f: "reviewedBy", sub: "id" },
      { f: "partner", sub: "id" },
    ];
    for (const { f, sub } of nestedCompare) {
      const a = (orig as any)[f]?.[sub] ?? null;
      const b = adapted[f]?.[sub] ?? null;
      if (a !== b) diffs.push(`${f}.${sub}: legacy=${a} adapted=${b}`);
    }

    if (diffs.length > 0) {
      mismatches++;
      console.log(`⚠️ ${orig.id}`);
      for (const d of diffs) console.log(`   ${d}`);
    } else {
      console.log(`✅ ${orig.id} matches`);
    }
  }

  console.log(`\nmismatches: ${mismatches}/${legacy.length}`);
  await prisma.$disconnect();
  process.exit(mismatches > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
