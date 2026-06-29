import { redirect } from "next/navigation";

export default function BacktestsPage() {
  redirect("/admin?tab=backtesting");
}
