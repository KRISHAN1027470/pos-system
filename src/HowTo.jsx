import { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  ReceiptText,
  Users,
  Package,
  Building2,
  Boxes,
  BarChart3,
  CreditCard,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "./HowTo.css";

const guides = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    keywords: "dashboard sales overview vat customers branch",
    steps: [
      "Open Dashboard from the left menu.",
      "Review Today's Sales, VAT Sales, Non-VAT Sales and customer totals.",
      "Use Recent Sales to check the latest completed invoices.",
      "Review the Payment Summary for Cash, Card and Bank sales.",
      "Use Branch Sales to compare today's performance by branch.",
    ],
  },
  {
    title: "POS Sales",
    icon: ShoppingCart,
    keywords: "pos sale checkout customer branch cart payment",
    steps: [
      "Open POS from the left menu.",
      "Select the correct branch before adding items.",
      "Choose VAT or Non-VAT sale as required.",
      "Select a customer when needed, especially for VAT invoices.",
      "Search items and add them to the cart.",
      "Adjust quantity or discount if required.",
      "Choose Cash, Card or Bank as the payment method.",
      "Complete the sale and verify the generated invoice number.",
    ],
  },
  {
    title: "Invoices",
    icon: FileText,
    keywords: "invoice print cancel vat non vat history",
    steps: [
      "Open Invoices from the left menu.",
      "Filter between VAT and Non-VAT invoices when required.",
      "Open an invoice to view its full details.",
      "Use Print to produce a customer copy.",
      "Use Cancel only when the invoice must be reversed.",
      "A cancelled invoice restores branch stock and creates a stock movement record.",
    ],
  },
  {
    title: "Quotes",
    icon: ReceiptText,
    keywords: "quote quotation estimate convert accepted sent",
    steps: [
      "Open Quotes from the left menu.",
      "Select branch, quotation type and customer.",
      "Add quotation items and discounts.",
      "Set a valid-until date and notes if needed.",
      "Create the quotation.",
      "Update the quotation status to Sent, Accepted or Rejected.",
      "Only Accepted quotations can be converted to invoices.",
      "When converted, branch stock is reduced automatically.",
    ],
  },
  {
    title: "Customers",
    icon: Users,
    keywords: "customer vat number credit limit contact",
    steps: [
      "Open Customers from the left menu.",
      "Click Add Customer.",
      "Choose VAT or Non-VAT customer type.",
      "Enter customer code, name and contact details.",
      "For VAT customers, enter the VAT number.",
      "Set a credit limit if your business uses customer credit.",
      "Use Edit or Delete to maintain customer records.",
    ],
  },
  {
    title: "Items",
    icon: Package,
    keywords: "item sku barcode price vat stock reorder",
    steps: [
      "Open Items from the left menu.",
      "Click Add Item.",
      "Enter SKU, barcode, item name, category and unit.",
      "Enter cost price and selling price.",
      "Choose VAT, Exempt or Non-VAT item type.",
      "Set the VAT rate where applicable.",
      "Set reorder level for low-stock monitoring.",
      "Use Stock Management for branch-specific stock changes.",
    ],
  },
  {
    title: "Branches",
    icon: Building2,
    keywords: "branch location code active inactive",
    steps: [
      "Open Branches from the left menu.",
      "Create a branch with branch code and branch name.",
      "Enter address, phone, email and VAT details if required.",
      "Keep operational branches set to Active.",
      "Inactive branches cannot be used for new branch transactions.",
    ],
  },
  {
    title: "Stock Management",
    icon: Boxes,
    keywords: "stock inventory transfer adjustment movement low stock",
    steps: [
      "Open Stock Management from the left menu.",
      "Select the branch you want to review.",
      "Use Stock In for additions and Stock Out for manual reductions.",
      "Enter a reason or remark for every adjustment.",
      "Use Branch Transfer to move stock between branches.",
      "Review Movement History for sales, cancellations, transfers and adjustments.",
      "Check low-stock and out-of-stock indicators regularly.",
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    keywords: "reports sales branch item customer stock movement csv print",
    steps: [
      "Open Reports from the left menu.",
      "Select the required report type.",
      "Choose the date range for sales or movement reports.",
      "Select a branch when you need branch-specific results.",
      "Review totals and detailed rows.",
      "Use CSV Export when you need the data in spreadsheet format.",
      "Use Print to produce a printable report.",
    ],
  },
  {
    title: "Billing",
    icon: CreditCard,
    keywords: "billing payment partial unpaid due balance settlement",
    steps: [
      "Open Billing from the left menu.",
      "Search by invoice, customer or branch.",
      "Use the payment status filter to find Paid, Partial or Unpaid invoices.",
      "For invoices with an outstanding balance, click Receive.",
      "Enter payment amount and select Cash, Card or Bank.",
      "Add a reference number and notes when required.",
      "Use History to review payments recorded against an invoice.",
    ],
  },
  {
    title: "Audit Logs",
    icon: ClipboardList,
    keywords: "audit history changes old new user activity",
    steps: [
      "Open Audit Logs from the left menu.",
      "Use search and filters to locate an activity.",
      "Filter by entity, action type or branch.",
      "Click View to inspect the activity details.",
      "Review Old Data and New Data to see exactly what changed.",
      "Audit Logs should be used when investigating edits, deletions or transaction changes.",
    ],
  },
];

export default function HowTo() {
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState(0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guides;

    return guides.filter((guide) =>
      `${guide.title} ${guide.keywords} ${guide.steps.join(" ")}`
        .toLowerCase()
        .includes(term)
    );
  }, [search]);

  return (
    <div className="howto-page">
      <div className="howto-header">
        <div>
          <h1>How To</h1>
          <p>Quick user guide for the LE POS system.</p>
        </div>
        <BookOpen size={32} />
      </div>

      <div className="howto-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenIndex(0);
          }}
          placeholder="Search POS, invoices, stock, billing..."
        />
      </div>

      <div className="howto-note">
        <strong>Recommended daily flow:</strong>
        <span>
          Check Dashboard → process sales in POS → review Billing and Stock Management
          → check Reports and Audit Logs when required.
        </span>
      </div>

      <div className="howto-list">
        {filtered.length === 0 && (
          <div className="howto-empty">No guide found for your search.</div>
        )}

        {filtered.map((guide, index) => {
          const Icon = guide.icon;
          const isOpen = openIndex === index;

          return (
            <div className="howto-card" key={guide.title}>
              <button
                className="howto-card-header"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <div className="howto-title">
                  <div className="howto-icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2>{guide.title}</h2>
                    <span>{guide.steps.length} steps</span>
                  </div>
                </div>

                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {isOpen && (
                <div className="howto-card-body">
                  <ol>
                    {guide.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
