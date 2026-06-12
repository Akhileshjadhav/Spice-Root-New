import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/spice-root/spice-root-logo.png";
import { formatProductMeta } from "./catalog";

function formatInvoicePrice(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export function downloadInvoicePdf(order) {
  const doc = new jsPDF();

  // =========================
  // HEADER
  // =========================

  doc.addImage(logo, "PNG", 14, 8, 50, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("SPICE ROOT", 150, 18, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.text("Delivering Fresh Flavours!", 150, 27, {
    align: "center",
  });

  doc.line(14, 35, 196, 35);

  // =========================
  // TAX INVOICE
  // =========================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TAX INVOICE", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  doc.text(`Invoice No: INV-${order.orderId}`, 14, 60);
  doc.text(`Order ID: ${order.orderId}`, 14, 70);
  doc.text(`Date: ${order.date}`, 14, 80);

  // =========================
  // CUSTOMER DETAILS
  // =========================

  doc.setTextColor(34, 139, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Customer Details", 14, 98);

  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.text("Name:", 14, 112);
  doc.text("Phone:", 14, 124);
  doc.text("Address:", 14, 136);

  doc.setFont("helvetica", "normal");

  doc.text(
    order.customerName ||
      order.raw?.customer?.fullName ||
      "Customer",
    38,
    112
  );

  doc.text(
    order.phone ||
      order.raw?.customer?.mobileNumber ||
      "-",
    38,
    124
  );

  const address = order.address || "Address Not Available";
  const splitAddress = doc.splitTextToSize(address, 145);

  doc.text(splitAddress, 38, 136);
  const tableStartY = 145 + (splitAddress.length * 8);

  // =========================
  // PRODUCT TABLE
  // =========================

  autoTable(doc, {
    startY: 165,
    head: [["Product", "Qty", "Price", "Amount"]],
    body: order.items.map((item) => [
      `${item.name} (${formatProductMeta(item) || "Standard"})`,
      item.quantity,
      formatInvoicePrice(item.price || 0),
      formatInvoicePrice(
        (item.price || 0) * (item.quantity || 0)
      ),
    ]),
    theme: "grid",
    styles: {
      fontSize: 11,
    },
    headStyles: {
      fillColor: [34, 139, 34],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
  });

  // =========================
  // BILL SUMMARY
  // =========================

  const finalY = doc.lastAutoTable.finalY + 15;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(
    `Subtotal: ${formatInvoicePrice(order.subtotal || order.amount)}`,
    14,
    finalY
  );

  if (order.discountAmount > 0) {
    doc.text(
      `Coupon Discount: -${formatInvoicePrice(order.discountAmount)}`,
      14,
      finalY + 10
    );
  }

  if (order.couponCode) {
    doc.text(
      `Coupon Applied: ${order.couponCode}`,
      14,
      finalY + 20
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);

  doc.text(
    `Grand Total: ${formatInvoicePrice(order.amount)}`,
    110,
    finalY + 40
  );

  // =========================
  // PAYMENT DETAILS
  // =========================

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(
    `Payment Method: ${order.paymentMethod || "Razorpay"}`,
    14,
    finalY + 55
  );

  doc.text(
    `Order Status: ${order.status}`,
    14,
    finalY + 67
  );

  // =========================
  // FOOTER
  // =========================

  doc.line(14, finalY + 80, 196, finalY + 80);

  doc.setFontSize(10);

  doc.text(
    "This is a computer-generated invoice and does not require a signature.",
    14,
    finalY + 95
  );

  doc.text(
    "Thank you for shopping with Spice Root.",
    14,
    finalY + 107
  );

  doc.save(`SpiceRoot-Invoice-${order.orderId}.pdf`);
}

