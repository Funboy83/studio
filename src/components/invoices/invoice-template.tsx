
"use client"

import type { InvoiceDetail } from "@/lib/types"

interface InvoiceTemplateProps {
  invoice: InvoiceDetail;
}

export function InvoiceTemplate({ invoice }: InvoiceTemplateProps) {

  const notes = invoice.summary || "Thank you for your business! Payment is due within 30 days.";

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-white text-black print:p-0 print:shadow-none print:border-0">
        <header className="mb-12">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">INVOICE</h1>
              <p className="font-semibold">Company Name</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Invoice No:</span> {invoice.invoiceNumber}</p>
              <p><span className="font-semibold">Date:</span> {invoice.issueDate}</p>
            </div>
          </div>
          <div className="w-full h-px bg-gray-300 my-6"></div>
          <div>
            <p className="font-semibold mb-1">To:</p>
            <p>{invoice.customer.name}</p>
          </div>
        </header>

        <main>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y-2 border-black">
                <th className="p-2 w-16">NO</th>
                <th className="p-2 w-20">QTY</th>
                <th className="p-2">DESCRIPTION</th>
                <th className="p-2 w-32 text-right">UNIT PRICE</th>
                <th className="p-2 w-32 text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">{item.productName}</td>
                  <td className="p-2 text-right">{item.unitPrice.toFixed(2)}</td>
                  <td className="p-2 text-right">{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
        
        <footer className="mt-12">
            <div className="flex justify-between items-end">
                 <div>
                    <p className="font-semibold mb-1">Notes:</p>
                    <p className="text-sm">{notes}</p>
                </div>
                <div className="border-2 border-black p-4">
                    <span className="font-bold text-lg">TOTAL: {invoice.total.toFixed(2)}</span>
                </div>
            </div>
        </footer>
    </div>
  );
}
