export const validCarrierCsv = `order_id,tracking_number,status,last_status_change_at
order_1,TRACK123,IN_TRANSIT,2026-09-01T10:00:00.000Z
order_2,TRACK456,DELIVERED,2026-09-05T08:30:00.000Z`;

export const malformedCarrierCsv = `order_id,tracking_number,status,last_status_change_at
order_1,TRACK123,NOT_A_REAL_STATUS,2026-09-01T10:00:00.000Z
order_2,TRACK456,,2026-09-05T08:30:00.000Z
order_3,TRACK789,DELIVERED,not-a-date`;
