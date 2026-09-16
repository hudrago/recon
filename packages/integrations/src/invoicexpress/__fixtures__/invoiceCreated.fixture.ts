export const invoiceXpressInvoiceCreatedFixture = {
  invoice: {
    id: 987654,
    reference: 'order_1',
    date: '2026-09-16',
  },
};

// Edge case: a string invoice id, as returned by some InvoiceXpress API responses.
export const invoiceXpressStringIdFixture = {
  invoice: {
    id: '987655',
    reference: 'order_2',
    date: '2026-09-16',
  },
};

export const malformedInvoiceXpressFixture = {
  invoice: {
    id: 987656,
    date: 'not-a-date',
  },
};
