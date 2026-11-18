import { useState } from "react";
import { Download, Share2, Database, FileJson, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";

interface ComplianceActionsProps {
  reportData?: any;
  fileNamePrefix?: string;
  hideHeader?: boolean;
  className?: string;
}

const ComplianceActions = ({
  reportData,
  fileNamePrefix = "COI_Report",
  hideHeader = false,
  className
}: ComplianceActionsProps) => {
  const [showRawData, setShowRawData] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadPDF = () => {
    if (!reportData) {
      toast.error("No data to download");
      return;
    }

    try {
      const escapePdf = (value: unknown) => String(value ?? "—").replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1");
      const findings = reportData.conflictLevel === 2
        ? (reportData.conflicts || []).map((c: any) => `Investor exposure: ${c.investedParent} owns ${c.competingSubsidiary}, which is linked to the target as a competitor. Evidence: ${c.evidenceType || "recorded relationship"}. ${c.notes || ""}`)
        : reportData.conflictType?.includes("sector")
          ? (reportData.conflictingCompanies || []).map((company: string) => `${company} shares the ${reportData.sector || "operating"} sector with the target. This is a screening signal, not proof of direct competition.`)
          : (reportData.conflictingCompanies || []).map((company: string) => `${company} has a recorded competition relationship with the target. Verify the source and current status.`);
      const content = [
        "STARTUPFORGE | CONFLICT SCREENING RECORD",
        `Generated: ${new Date().toISOString()}`,
        `Investor / fund: ${reportData.investor || reportData.investorName || "Not supplied"}`,
        `Target company: ${reportData.targetCompany || "Not supplied"}`,
        `Outcome: ${reportData.hasConflict ? "Potential conflict identified" : "No conflict identified in available records"}`,
        `Screening level: ${reportData.conflictLevel ?? 0}`,
        `Conflict type: ${reportData.conflictType || "No matching conflict path"}`,
        `Confidence: ${reportData.confidence || "Graph records only"}`,
        `Data classification: ${reportData.dataClassification || "StartupForge relationship graph"}`,
        "",
        "Findings",
        ...(findings.length ? findings : ["No matching conflict paths were found in the available records."]),
        ...(reportData.hasConflict ? ["", "Recommended next step: verify the relationship and obtain independent legal/compliance review before relying on this screening."] : ["", "This result covers relationships present in the connected StartupForge records at the time of screening."]),
        "This screening record is informational and is not legal advice or a legal determination.",
      ];
      const lines = content.flatMap(line => {
        const words = String(line).split(/\s+/); const wrapped: string[] = []; let current = "";
        words.forEach(word => { if (current && `${current} ${word}`.length > 88) { wrapped.push(current); current = word; } else current = current ? `${current} ${word}` : word; });
        if (current) wrapped.push(current); return wrapped;
      });
      const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 48)) }, (_, i) => lines.slice(i * 48, (i + 1) * 48));
      const objects: string[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
      const pageIds: number[] = [];
      pages.forEach((pageLines, pageIndex) => {
        const pageId = objects.length + 1; const contentId = pageId + 1; pageIds.push(pageId);
        const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", ...pageLines.map((line, index) => `${index ? "T* " : ""}(${escapePdf(line)}) Tj`), "ET", "BT", "/F1 8 Tf", "50 35 Td", `(${escapePdf(`StartupForge screening record - page ${pageIndex + 1} of ${pages.length}`)}) Tj`, "ET"].join("\n");
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
        objects.push(`<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`);
      });
      objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
      objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
      let pdf = "%PDF-1.4\n";
      const offsets = [0];
      objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
      const xref = new TextEncoder().encode(pdf).length;
      pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileNamePrefix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF downloaded");

    } catch (e) {
      console.error(e);
      toast.error("Failed to generate report");
    }
  };

  const handleExportGraph = () => {
    if (!reportData) return;

    // Prefer the exact paths and relationship evidence returned by the graph API.
    // Keep a fallback for older backend responses while they are being upgraded.
    const graphData = reportData.graph?.nodes && reportData.graph?.edges
      ? {
        schemaVersion: "1.0",
        meta: {
          investor: reportData.investor || reportData.investorName,
          target: reportData.targetCompany,
          conflictType: reportData.conflictType,
          conflictLevel: reportData.conflictLevel,
          confidence: reportData.confidence,
          dataClassification: reportData.dataClassification,
          generatedAt: new Date().toISOString(),
          evidenceNote: "Edge properties are copied from the graph database; verify sources and current status."
        },
        nodes: reportData.graph.nodes,
        edges: reportData.graph.edges
      }
      : {
      schemaVersion: "1.0",
      meta: {
        investor: reportData.investor || reportData.investorName,
        target: reportData.targetCompany,
        conflictType: reportData.conflictType,
        confidence: reportData.confidence,
        dataClassification: reportData.dataClassification,
        generatedAt: new Date().toISOString()
      },
      nodes: [
        { id: "inv", label: reportData.investorName, type: "investor" },
        { id: "tgt", label: reportData.targetCompany, type: "target" }
      ],
      edges: [] as any[]
    };

    if (reportData.conflictLevel === 1 && reportData.conflictingCompanies) {
      reportData.conflictingCompanies.slice(0, 10).forEach((comp: string, i: number) => {
        const id = `l1-${i}`;
        graphData.nodes.push({ id, label: comp, type: "company" });
        graphData.edges.push({ from: "inv", to: id, relation: "invested_in" });
        graphData.edges.push({ from: id, to: "tgt", relation: reportData.conflictType?.includes("sector") ? "same_sector_as" : "competes_with" });
      });
    } else if (reportData.conflictLevel === 2 && reportData.conflicts) {
      reportData.conflicts.forEach((c: any, i: number) => {
        const pid = `p-${i}`;
        const sid = `s-${i}`;
        graphData.nodes.push({ id: pid, label: c.investedParent, type: "company" });
        graphData.nodes.push({ id: sid, label: c.competingSubsidiary, type: "company" });
        graphData.edges.push({ from: "inv", to: pid, relation: "invested_in" });
        graphData.edges.push({ from: pid, to: sid, relation: "owns" });
        graphData.edges.push({ from: sid, to: "tgt", relation: "competes_with" });
      });
    }

    const nodeNames = new Map(graphData.nodes.map((node: any) => [String(node.id), node.label || node.name || node.id]));
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [["From", "Relationship", "To", "Evidence / notes"], ...graphData.edges.map((edge: any) => [nodeNames.get(String(edge.from ?? edge.source)) || edge.from || edge.source, String(edge.relation || edge.type || "related to").replace(/_/g, " ").toLowerCase(), nodeNames.get(String(edge.to ?? edge.target)) || edge.to || edge.target, edge.evidence_type || edge.evidence || edge.notes || ""]), ...(!graphData.edges.length ? [[reportData.investor || reportData.investorName || "Investor", "screened against", reportData.targetCompany || "Target company", reportData.hasConflict ? "Potential conflict identified" : "No conflict identified in available records"]] : [])];
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePrefix}_relationships.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Graph Data Exported", {
      description: "Readable relationship table saved as CSV for Excel or Google Sheets.",
    });
  };

  const handleCopyRaw = () => {
    if (reportData) {
      navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <>
      <Card className={cn("animate-fade-in bg-white border-border rounded-[2.5rem] shadow-sm overflow-hidden p-4", className)}>
        {!hideHeader && (
          <CardHeader className="pb-3 p-6">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              Compliance Actions
            </CardTitle>
          </CardHeader>
        )}

        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="default"
              onClick={handleDownloadPDF}
              className="w-full h-14 rounded-2xl font-bold text-sm shadow-md hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              <Download className="h-5 w-5" />
              Download PDF Report
            </Button>

            <Button
              variant="outline"
              onClick={handleExportGraph}
              className="w-full h-14 rounded-2xl font-bold text-sm border-2 border-primary/20 text-primary hover:bg-primary/5 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              <Share2 className="h-5 w-5" />
              Export Graph Data
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowRawData(true)}
              className="w-full h-14 rounded-2xl font-bold text-sm bg-secondary/50 text-foreground hover:bg-secondary hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              <FileJson className="h-5 w-5" />
              View Raw Data
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-4 p-5 rounded-[1.5rem] bg-[#F8FAFC] border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              This report is generated from the conflict screening result shown here. Downloaded copies are saved to your device.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Raw Data Dialog */}
      <Dialog open={showRawData} onOpenChange={setShowRawData}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col rounded-3xl">
          <DialogHeader>
            <DialogTitle>Conflict screening details</DialogTitle>
            <DialogDescription>
              A readable summary of the records used for this screening.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Investor / fund</p><p className="mt-1 font-semibold">{reportData?.investor || reportData?.investorName || "Not provided"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Target company</p><p className="mt-1 font-semibold">{reportData?.targetCompany || "Not provided"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Screening result</p><p className="mt-1 font-semibold">{reportData?.hasConflict ? "Potential conflict identified" : "No conflict found in available records"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Screening signal</p><p className="mt-1 font-semibold">{reportData?.conflictType?.replace(/[_-]/g, " ") || "No matching relationship"}{reportData?.sector ? ` · ${reportData.sector}` : ""}</p></div>
            </div>
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">Companies and relationships found</h3>
              {reportData?.conflictLevel === 2 && reportData?.conflicts?.length ? <ul className="mt-3 space-y-3">{reportData.conflicts.map((item: any, index: number) => <li key={index} className="rounded-lg bg-muted/40 p-3 text-sm"><p><strong>{item.investedParent || "Portfolio company"}</strong> owns <strong>{item.competingSubsidiary || "a subsidiary"}</strong>, which is linked to the target as a competitor.</p><p className="mt-1 text-muted-foreground">Evidence: {item.evidenceType || "Recorded graph relationship"}{item.notes ? ` · ${item.notes}` : ""}</p></li>)}</ul>
                : reportData?.conflictingCompanies?.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{reportData.conflictingCompanies.map((company: string, index: number) => <li key={index}>{company}{reportData?.sector ? ` — shares the ${reportData.sector} sector` : " — recorded as a related or competing company"}</li>)}</ul>
                  : <p className="mt-2 text-sm text-muted-foreground">No matching company relationships were returned for this screening.</p>}
            </section>
            {reportData?.graph?.edges?.length > 0 && <section className="rounded-xl border p-4"><h3 className="font-semibold">Relationship path</h3><ol className="mt-2 space-y-2 text-sm">{reportData.graph.edges.map((edge: any, index: number) => { const nodes = new Map(reportData.graph.nodes.map((n: any) => [String(n.id), n.label || n.name || n.id])); return <li key={index} className="flex flex-wrap items-center gap-2"><span className="font-medium">{nodes.get(String(edge.from ?? edge.source)) || edge.from || edge.source}</span><span className="rounded bg-muted px-2 py-1 text-xs">{String(edge.relation || edge.type || "related to").replace(/_/g, " ").toLowerCase()}</span><span className="font-medium">{nodes.get(String(edge.to ?? edge.target)) || edge.to || edge.target}</span></li>; })}</ol></section>}
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">Technical data (JSON)</summary>
              <div className="relative mt-3 rounded-lg bg-slate-950 p-4">
                <Button size="sm" variant="ghost" className="absolute right-2 top-2 text-slate-300" onClick={handleCopyRaw}>
                  {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy data"}
                </Button>
                <pre className="max-h-64 overflow-auto pt-10 text-xs text-green-300 whitespace-pre-wrap break-words">{JSON.stringify(reportData, null, 2)}</pre>
              </div>
            </details>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ComplianceActions;

