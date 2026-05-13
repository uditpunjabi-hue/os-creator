'use client';

import { Bell } from 'lucide-react';
import { Card, CardContent } from '@gitroom/frontend/components/shadcn/ui/card';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { PageHeader, PageBody, ComingSoonBanner } from '@gitroom/frontend/components/shadcn/page-header';

type Status = 'PENDING' | 'INVOICED' | 'PAID' | 'OVERDUE';

const statusVariant: Record<Status, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  INVOICED: 'warning',
  PAID: 'success',
  OVERDUE: 'destructive',
};

const rows: Array<{ id: string; influencer: string; brand: string; amount: string; due: string; status: Status }> = [
  { id: '1', influencer: 'Kira S.', brand: 'Bloom & Co.', amount: '$3,500', due: 'Mar 22', status: 'INVOICED' },
  { id: '2', influencer: 'Amir P.', brand: 'Nimbus', amount: '$6,200', due: 'Mar 14', status: 'OVERDUE' },
  { id: '3', influencer: 'Nimo R.', brand: 'BrandLab', amount: '$4,200', due: 'Apr 02', status: 'PENDING' },
  { id: '4', influencer: 'Kira S.', brand: 'Swift', amount: '$8,500', due: 'Feb 28', status: 'PAID' },
];

export default function Commercials() {
  return (
    <>
      <PageHeader
        title="Commercials"
        description="Track brand commercials and payment status per influencer."
        actions={
          <Button variant="outline">
            <Bell className="h-4 w-4" /> Send reminders
          </Button>
        }
      />
      <PageBody className="flex flex-col gap-6">
        <ComingSoonBanner feature="Invoicing + payment reminder automation" />

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">Influencer</th>
                  <th className="px-5 py-3">Brand</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.influencer}</td>
                    <td className="px-5 py-3 text-gray-700">{r.brand}</td>
                    <td className="px-5 py-3 text-gray-900">{r.amount}</td>
                    <td className="px-5 py-3 text-gray-500">{r.due}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
