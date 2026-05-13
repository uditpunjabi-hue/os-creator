'use client';

import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@gitroom/frontend/components/shadcn/ui/card';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { PageHeader, PageBody, ComingSoonBanner } from '@gitroom/frontend/components/shadcn/page-header';

const placeholderScript = `Hook (0-3s): Drop a question — "What if your launch reel converted twice as well?"
Body (3-20s):
  • Quick before/after split
  • Show one pacing trick I changed
  • Show the engagement delta
CTA (20-30s):
  • "Tap the link in bio for the full breakdown"
`;

export default function ScriptEditor() {
  const [script, setScript] = useState(placeholderScript);
  const [feedback, setFeedback] = useState('');

  return (
    <>
      <PageHeader
        title="Script editor"
        description="Review the AI draft, approve to schedule, or reject to regenerate."
        actions={<Badge variant="warning">In Review</Badge>}
      />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ComingSoonBanner feature="Real-time collaboration and regeneration" />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-[320px] w-full resize-y rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button>
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4" /> Regenerate
              </Button>
              <Button variant="destructive">
                <X className="h-4 w-4" /> Reject
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback for the next pass</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What should change on the next regeneration?"
                className="min-h-[140px] w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
