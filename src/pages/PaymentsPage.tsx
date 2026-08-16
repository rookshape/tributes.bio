import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getCreatorPayments,
  type CreatorPayment,
} from "../lib/payments";

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PaymentsPage() {
  const { appUser, user } = useAuth();
  const [payments, setPayments] = useState<CreatorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || appUser?.accountType !== "creator") {
      setLoading(false);
      return;
    }

    let active = true;
    getCreatorPayments(user.uid)
      .then((result) => {
        if (active) {
          setPayments(result);
        }
      })
      .catch(() => {
        if (active) {
          setError("Could not load payments.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [appUser?.accountType, user]);

  const receivedCents = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "succeeded")
        .reduce((total, payment) => total + payment.creatorAmountCents, 0),
    [payments],
  );

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {currency(receivedCents)} received
        </p>
      </div>

      {error ? <p className="mt-5 text-sm text-red-700">{error}</p> : null}

      {!error && payments.length === 0 ? (
        <p className="py-12 text-sm text-zinc-500">No payments yet.</p>
      ) : null}

      {payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="py-3 pr-4 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="py-3 pl-4 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr className="border-b border-zinc-100" key={payment.id}>
                  <td className="py-4 pr-4 font-medium">
                    {payment.anonymous || !payment.senderName
                      ? "Anonymous"
                      : payment.senderName}
                  </td>
                  <td className="px-4 py-4 capitalize text-zinc-600">
                    {payment.kind}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {payment.createdAt
                      ? payment.createdAt.toLocaleDateString()
                      : "Pending"}
                  </td>
                  <td className="px-4 py-4 capitalize text-zinc-600">
                    {payment.status.replaceAll("_", " ")}
                  </td>
                  <td className="py-4 pl-4 text-right font-semibold">
                    {currency(payment.creatorAmountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
