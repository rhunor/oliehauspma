// FILE: src/app/admin/migrate/page.tsx - FIXED TYPE ERRORS
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MigrationStats {
  total: number;
  migrated: number;
  failed: number;
  details?: Array<{
    title: string;
    status: string;
    error?: string;
  }>;
}

interface MigrationStatus {
  needsMigration: number;
  alreadyMigrated: number;
  total: number;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  stats?: MigrationStats;
  status?: MigrationStatus;
  ready?: boolean;
  details?: string;
}

export default function MigrationPage() {
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/migrate/managers');
      const data = await response.json() as ApiResponse;
      setResult(data);
    } catch (error) {
      setResult({ 
        error: 'Failed to check status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('Are you sure you want to run the migration? This will update all projects with a managers array.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/migrate/managers', {
        method: 'POST',
      });
      const data = await response.json() as ApiResponse;
      setResult(data);
    } catch (error) {
      setResult({ 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Database Migration: Multiple Managers</CardTitle>
          <p className="text-sm text-gray-600">
            This migration will convert all projects from single manager to multiple managers array.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={checkStatus} disabled={loading} variant="outline">
              {loading ? 'Checking...' : 'Check Status'}
            </Button>
            
            <Button onClick={runMigration} disabled={loading}>
              {loading ? 'Running Migration...' : 'Run Migration'}
            </Button>
          </div>
          
          {result && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Result:</h3>
              
              {result.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800 font-semibold">Error:</p>
                  <p className="text-red-700">{result.error}</p>
                  {result.details && (
                    <p className="text-red-600 text-sm mt-2">{result.details}</p>
                  )}
                </div>
              ) : result.success && result.message ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800 font-semibold">Success!</p>
                  <p className="text-green-700">{result.message}</p>
                  
                  {result.stats && (
                    <div className="mt-3 space-y-1 text-sm">
                      <p>Total projects: {result.stats.total}</p>
                      <p>Successfully migrated: {result.stats.migrated}</p>
                      <p>Failed: {result.stats.failed}</p>
                    </div>
                  )}
                </div>
              ) : result.status ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-blue-800 font-semibold">Migration Status:</p>
                  <div className="mt-2 space-y-1 text-sm text-blue-700">
                    <p>Projects needing migration: {result.status.needsMigration}</p>
                    <p>Already migrated: {result.status.alreadyMigrated}</p>
                    <p>Total projects: {result.status.total}</p>
                  </div>
                  {result.ready && (
                    <p className="mt-3 text-blue-800 font-semibold">
                      ✓ Ready to run migration
                    </p>
                  )}
                </div>
              ) : null}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                  Show raw JSON response
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-semibold text-yellow-800 mb-2">Important Notes:</h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>This migration is safe to run multiple times</li>
              <li>It will only update projects that need migration</li>
              <li>The old &apos;manager&apos; field will be preserved for backward compatibility</li>
              <li>Only super_admin users can run this migration</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}