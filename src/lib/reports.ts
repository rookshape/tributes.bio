import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type ReportCategory =
  | "spam"
  | "scam"
  | "impersonation"
  | "harassment"
  | "prohibited_content"
  | "other";

export type ContentReportInput = {
  creatorId: string;
  targetType: "profile" | "link";
  targetId: string | null;
  category: ReportCategory;
  details: string;
  reporterEmail: string;
};

const submitReportCall = httpsCallable<
  ContentReportInput,
  { reportId: string }
>(functions, "submitContentReport");

export async function submitContentReport(input: ContentReportInput) {
  const result = await submitReportCall(input);
  return result.data.reportId;
}
