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
      const lines = [
        "STARTUPFORGE | CONFLICT SCREENING RECORD",
        `Generated: ${new Date().toISOString()}`,
        `Investor / fund: ${reportData.investor || reportData.investorName || "Not supplied"}`,
        `Target company: ${reportData.targetCompany || "Not supplied"}`,
        `Outcome: ${reportData.hasConflict ? "Potential conflict identified" : "No conflict identified in available records"}`,
        `Screening level: ${reportData.conflictLevel ?? 0}`,
        "",
        "Findings",
        ...(reportData.conflictLevel === 2
          ? (reportData.conflicts || []).map((c: any) => `Direct investment in ${c.investedParent}; related entity ${c.competingSubsidiary} may compete with target.`)
          : (reportData.conflictingCompanies || []).map((company: string) => `Portfolio company ${company} has a reported sector overlap with target.`)),
        ...(reportData.hasConflict ? ["", "Recommended next step: verify the relationship and obtain independent legal/compliance review before relying on this screening."] : ["", "This result covers relationships present in the connected StartupForge records at the time of screening."]),
        "This screening record is informational and is not legal advice or a legal determination.",
      ];
      const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", ...lines.slice(0, 48).map((line, index) => `${index ? "T* " : ""}(${escapePdf(line)}) Tj`), "ET", "BT", "/F1 8 Tf", "50 35 Td", "(StartupForge screening record - verify source data before use.) Tj", "ET"].join("\n");
      const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`,
      ];
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

    // Construct a JSON representation of the graph
    const graphData = {
      meta: {
        investor: reportData.investorName,
        target: reportData.targetCompany,
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
        graphData.edges.push({ from: id, to: "tgt", relation: "competes_with_sector" });
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

    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePrefix}_graph.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Graph Data Exported", {
      description: "Relationship data saved as JSON.",
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
            <DialogTitle>Raw Analysis Data</DialogTitle>
            <DialogDescription>
              Complete JSON response from the conflict engine.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl relative group">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800"
              onClick={handleCopyRaw}
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ComplianceActions;
