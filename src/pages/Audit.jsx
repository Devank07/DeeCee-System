import React from 'react';
import { useCol, PageHeader, Card, DataTable } from '../ui';
import { fmtDateTime } from '../utils';
import { ROLES } from '../constants';

const LABEL = { clients: 'Client', projects: 'Client tab / order', files: 'Drawing / document', teams: 'Team', payroll: 'Salary', invoices: 'Invoice', payments: 'Payment', amcs: 'AMC', complaints: 'Complaint', visits: 'Field job', items: 'Stock item', stockMoves: 'Stock move', vendors: 'Vendor', purchaseOrders: 'Purchase order', dispatches: 'Dispatch', staff: 'Staff', attendance: 'Attendance', activity: 'Timeline post', photos: 'Photo', settings: 'Settings', users: 'User' };

export default function Audit() {
  const rows = useCol('audit', [], true, { orderBy: ['at', 'desc'], limit: 500 });
  return (
    <div className="page">
      <PageHeader title="Audit log" sub="Who changed what, and when — the latest 500 changes" />
      <Card pad={false}>
        <DataTable csvName="audit-log" rows={rows} initialSort={{ key: 'at', desc: true }}
          columns={[
            { key: 'at', label: 'When', value: (r) => fmtDateTime(r.at), sortValue: (r) => r.at, csv: (r) => new Date(r.at).toISOString() },
            { key: 'name', label: 'User', render: (r) => <>{r.name}<div className="muted small">{String(r.role || '').split(',').map((x) => ROLES[x] || x).join(' · ')}</div></>, csv: (r) => r.name },
            { key: 'action', label: 'Action' },
            { key: 'col', label: 'Record', value: (r) => LABEL[r.col] || r.col },
            { key: 'label', label: 'Detail' },
          ]} />
      </Card>
    </div>
  );
}
