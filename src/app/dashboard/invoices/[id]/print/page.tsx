
import { getInvoiceById } from "@/lib/actions/invoice";
import { notFound } from 'next/navigation';
import { InvoiceTemplate } from "@/components/invoices/invoice-template";

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const invoice = await getInvoiceById(params.id);

  if (!invoice) {
    notFound();
  }

  return (
    <html>
      <head>
        <title>Invoice {invoice.invoiceNumber}</title>
        <script>
          setTimeout(() => {{
            window.print();
            window.onafterprint = () => window.close();
          }}, 500);
        </script>
      </head>
      <body>
        <InvoiceTemplate invoice={invoice} />
      </body>
    </html>
  );
}
