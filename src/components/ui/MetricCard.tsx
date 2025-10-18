// src/components/ui/MetricCard.tsx
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Metric } from '@/types/dashboard';

interface MetricCardProps {
  metric: Metric;
  className?: string;
}

export default function MetricCard({ metric, className }: MetricCardProps) {
  const isUp = (metric.trendPercent ?? 0) > 0;
  const isDown = (metric.trendPercent ?? 0) < 0;

  const content = (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{metric.label}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{metric.value}</p>
        </div>
        <div
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            isUp && 'bg-emerald-50 text-emerald-700',
            isDown && 'bg-red-50 text-red-700',
            !isUp && !isDown && 'bg-slate-50 text-slate-600'
          )}
        >
          {isUp && <ArrowUpRight className="mr-1 h-3 w-3" />}
          {isDown && <ArrowDownRight className="mr-1 h-3 w-3" />}
          {!isUp && !isDown && <Minus className="mr-1 h-3 w-3" />}
          {typeof metric.trendPercent === 'number' ? `${Math.abs(metric.trendPercent)}%` : '—'}
        </div>
      </div>
    </div>
  );

  if (metric.href) {
    return (
      <Link href={metric.href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}


