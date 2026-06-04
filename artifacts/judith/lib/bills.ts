import { requireSupabase } from "./supabase";

export type BillCategory =
  | "electricity"
  | "water"
  | "internet"
  | "mobile"
  | "landline"
  | "custom";

export type AmountType = "fixed" | "variable";
export type Cadence = "monthly" | "one_time";
export type BillStatus =
  | "upcoming"
  | "due_soon"
  | "overdue"
  | "paid"
  | "snoozed";

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  category: BillCategory;
  provider: string | null;
  amount_type: AmountType;
  amount: number | null;
  due_day: number | null;
  due_date: string | null;
  cadence: Cadence;
  status: BillStatus;
  reminder_offsets: number[];
  snoozed_until: string | null;
  created_at: string;
}

export type BillInput = Omit<Bill, "id" | "user_id" | "created_at" | "status"> & {
  status?: BillStatus;
};

export const CATEGORY_META: Record<
  BillCategory,
  { label: string; icon: string }
> = {
  electricity: { label: "Kuryente", icon: "zap" },
  water: { label: "Tubig", icon: "droplet" },
  internet: { label: "Internet", icon: "wifi" },
  mobile: { label: "Mobile", icon: "smartphone" },
  landline: { label: "Landline", icon: "phone" },
  custom: { label: "Iba pa", icon: "file-text" },
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Resolves a bill's next due date (handles monthly recurrence). */
export function computeNextDue(bill: Bill, today: Date = new Date()): Date | null {
  if (bill.cadence === "one_time") {
    return bill.due_date ? new Date(`${bill.due_date}T00:00:00`) : null;
  }
  if (!bill.due_day) return null;
  const base = startOfDay(today);
  const dayFor = (y: number, m: number) =>
    Math.min(bill.due_day!, daysInMonth(y, m));
  let candidate = new Date(
    base.getFullYear(),
    base.getMonth(),
    dayFor(base.getFullYear(), base.getMonth()),
  );
  if (candidate < base) {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    candidate = new Date(y, m, dayFor(y, m));
  }
  return candidate;
}

export function daysUntil(date: Date, today: Date = new Date()): number {
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000,
  );
}

export type Urgency = "overdue" | "urgent" | "near" | "ok" | "paid";

export function urgencyOf(bill: Bill, today: Date = new Date()): Urgency {
  if (bill.status === "paid") return "paid";
  const due = computeNextDue(bill, today);
  if (!due) return "ok";
  const d = daysUntil(due, today);
  if (d < 0) return "overdue";
  if (d <= 3) return "urgent";
  if (d <= 7) return "near";
  return "ok";
}

// --- CRUD -----------------------------------------------------------------

export async function listBills(): Promise<Bill[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Bill[];
}

export async function createBill(input: BillInput): Promise<Bill> {
  const supabase = requireSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("bills")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(
  id: string,
  patch: Partial<BillInput>,
): Promise<Bill> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("bills")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw error;
}

export async function markPaid(id: string): Promise<Bill> {
  return updateBill(id, { status: "paid" });
}

export async function markUnpaid(id: string): Promise<Bill> {
  return updateBill(id, { status: "upcoming" });
}

export async function snoozeBill(id: string, days = 3): Promise<Bill> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return updateBill(id, {
    status: "snoozed",
    snoozed_until: until.toISOString().slice(0, 10),
  });
}

export async function unsnoozeBill(id: string): Promise<Bill> {
  return updateBill(id, { status: "upcoming", snoozed_until: null });
}
